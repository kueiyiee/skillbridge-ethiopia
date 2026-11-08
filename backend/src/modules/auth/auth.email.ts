import { Resend } from 'resend';
import { z } from 'zod';
import { AuthError } from './auth.errors';
import { getEmailOtpTtlMinutes } from './auth.email-verification.config';

type VerificationEmailPayload = Parameters<Resend['emails']['send']>[0];
export type AuthEmailSender = (apiKey: string, payload: VerificationEmailPayload) => Promise<{
  data?: { id?: string } | null;
  error: unknown | null;
}>;
export interface VerificationEmailContext {
  requestId?: string;
}

const verifiedSenderAddress = 'securityteam@kueiyiee.tech';
const recipientEmailSchema = z.string().trim().email();
const sendWithResend: AuthEmailSender = async (apiKey, payload) => {
  const result = await new Resend(apiKey).emails.send(payload);
  return { data: result.data, error: result.error };
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character);
}

function emailConfigurationError(): AuthError {
  console.error('[auth-email] Configure RESEND_API_KEY and OTP_FROM_EMAIL with the verified SKILLBRIDGE ET sender.');
  const message = process.env.NODE_ENV === 'production'
    ? 'Verification email delivery is temporarily unavailable. Please try again later.'
    : 'Email delivery is not configured. Set RESEND_API_KEY and OTP_FROM_EMAIL="SKILLBRIDGE ET <securityteam@kueiyiee.tech>" in the server environment.';
  return new AuthError(message, 503);
}

function emailProviderError(): AuthError {
  const message = process.env.NODE_ENV === 'production'
    ? 'Verification email delivery is temporarily unavailable. Please try again later.'
    : 'Resend could not deliver the verification email. Check the API key and verify the sender domain used by OTP_FROM_EMAIL.';
  return new AuthError(message, 503);
}

export function assertEmailDeliveryConfigured(): void {
  const from = process.env.OTP_FROM_EMAIL?.trim();
  const senderAddress = from?.match(/<([^<>]+)>/)?.[1]?.trim() ?? from;
  const apiKeyConfigured = Boolean(process.env.RESEND_API_KEY?.trim());
  const senderConfigured = Boolean(senderAddress);
  const senderVerified = senderAddress?.toLowerCase() === verifiedSenderAddress;
  if (!apiKeyConfigured || !senderConfigured || !senderVerified) {
    console.error('[auth-email] Email provider configuration check failed.', {
      apiKeyConfigured,
      senderConfigured,
      senderVerified,
    });
    throw emailConfigurationError();
  }
}

export function getEmailVerificationUrl(): string {
  const configuredUrl = process.env.EMAIL_VERIFICATION_URL?.trim();
  const appUrl = process.env.APP_URL?.trim();
  const value = configuredUrl || `${(appUrl || 'http://127.0.0.1:5173').replace(/\/$/, '')}/verify-email`;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/verify-email') throw new Error('Invalid verification URL.');
    return url.toString();
  } catch {
    console.error('[auth-email] Verification page URL configuration is invalid.');
    throw new AuthError('Verification email delivery is temporarily unavailable. Please try again later.', 503);
  }
}

function providerErrorDetails(error: unknown): { errorType: string; statusCode?: number } {
  if (!error || typeof error !== 'object') return { errorType: 'UnknownProviderError' };
  const details = error as { name?: unknown; statusCode?: unknown };
  return {
    errorType: typeof details.name === 'string' ? details.name : 'ProviderError',
    ...(typeof details.statusCode === 'number' ? { statusCode: details.statusCode } : {}),
  };
}

async function sendConfiguredEmail(
  to: string,
  payload: VerificationEmailPayload,
  sender: AuthEmailSender,
  context: VerificationEmailContext,
  emailPurpose: 'verification' | 'password-reset' | 'password-changed',
): Promise<{ messageId: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw emailConfigurationError();
  let result: Awaited<ReturnType<AuthEmailSender>>;
  try {
    result = await sender(apiKey, payload);
  } catch (error) {
    console.error(`[auth-email] Resend ${emailPurpose} request failed.`, {
      requestId: context.requestId,
      ...providerErrorDetails(error),
    });
    throw emailProviderError();
  }

  if (result.error) {
    console.error(`[auth-email] Resend rejected ${emailPurpose} email.`, {
      requestId: context.requestId,
      ...providerErrorDetails(result.error),
    });
    throw emailProviderError();
  }
  const messageId = result.data?.id;
  if (!messageId) {
    console.error(`[auth-email] Resend returned no message ID for ${emailPurpose} email.`, { requestId: context.requestId });
    throw emailProviderError();
  }
  console.info(`[auth-email] Resend accepted ${emailPurpose} email.`, {
    requestId: context.requestId,
    messageId,
  });
  return { messageId };
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  sender: AuthEmailSender = sendWithResend,
  context: VerificationEmailContext = {},
): Promise<{ messageId: string }> {
  const from = process.env.OTP_FROM_EMAIL;
  if (!recipientEmailSchema.safeParse(to).success) {
    throw new AuthError('A valid recipient email address is required.', 400);
  }
  if (!/^\d{6}$/.test(code)) {
    throw new AuthError('The verification code is invalid.', 400);
  }
  assertEmailDeliveryConfigured();
  if (!from) throw emailConfigurationError();

  const appName = process.env.APP_NAME || 'SKILLBRIDGE ET';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@skillbridge.et';
  const verificationUrl = getEmailVerificationUrl();
  const escapedAppName = escapeHtml(appName);
  const escapedSupportEmail = escapeHtml(supportEmail);
  const escapedVerificationUrl = escapeHtml(verificationUrl);
  const expiresInMinutes = getEmailOtpTtlMinutes();

  const payload: VerificationEmailPayload = {
    from,
    to,
    subject: `Your ${appName} verification code`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f1f5f9">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
          <tr><td style="padding:26px 30px;background:#10263d;color:#fff;font-size:18px;font-weight:700">${escapedAppName}</td></tr>
          <tr><td style="padding:32px 30px">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3">Verify your email address</h1>
            <p style="margin:0 0 24px;color:#475569;line-height:1.6">Enter this one-time code to verify your email and finish creating your account.</p>
            <div style="margin:0 0 22px;padding:18px 12px;border:1px solid #99f6e4;border-radius:12px;background:#f0fdfa;text-align:center;color:#115e59;font-size:32px;font-weight:700;letter-spacing:8px">${code}</div>
            <p style="margin:0 0 14px;color:#475569;line-height:1.6">This code expires in ${expiresInMinutes} minutes from when it was sent. Do not share it with anyone; ${escapedAppName} will never ask you to share it.</p>
            <p style="margin:0 0 22px;color:#475569;line-height:1.6">If you did not request this code, you can ignore this email.</p>
            <p style="margin:0;color:#475569;line-height:1.6"><a href="${escapedVerificationUrl}" style="color:#0f766e">Open the verification page</a></p>
          </td></tr>
          <tr><td style="padding:18px 30px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6">Need help? Contact <a href="mailto:${escapedSupportEmail}" style="color:#0f766e">${escapedSupportEmail}</a>.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
 </html>`,
    text: `${appName}\n\nVerify your email address\n\nYour one-time verification code is: ${code}\n\nThis code expires in ${expiresInMinutes} minutes from when it was sent. Do not share it with anyone. If you did not request this code, ignore this email.\n\nVerification page: ${verificationUrl}\nSupport: ${supportEmail}`
  };
  return sendConfiguredEmail(to, payload, sender, context, 'verification');
}

export async function sendPasswordResetEmail(
  to: string,
  code: string,
  sender: AuthEmailSender = sendWithResend,
  context: VerificationEmailContext = {},
): Promise<{ messageId: string }> {
  if (!recipientEmailSchema.safeParse(to).success) throw new AuthError('A valid recipient email address is required.', 400);
  if (!/^\d{6}$/.test(code)) throw new AuthError('The reset code is invalid.', 400);
  assertEmailDeliveryConfigured();
  const from = process.env.OTP_FROM_EMAIL;
  if (!from) throw emailConfigurationError();
  const appName = process.env.APP_NAME || 'SKILLBRIDGE ET';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@skillbridge.et';
  const expiresInMinutes = getEmailOtpTtlMinutes();
  const safeName = escapeHtml(appName);
  const safeSupport = escapeHtml(supportEmail);
  return sendConfiguredEmail(to, {
    from,
    to,
    subject: `Reset your ${appName} password`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f1f5f9"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <tr><td style="padding:26px 30px;background:#10263d;color:#fff;font-size:18px;font-weight:700">${safeName}</td></tr>
      <tr><td style="padding:32px 30px"><h1 style="margin:0 0 12px;font-size:24px">Reset your password</h1>
        <p style="margin:0 0 24px;color:#475569;line-height:1.6">Enter this one-time code to choose a new password for your account.</p>
        <div style="margin:0 0 22px;padding:18px 12px;border:1px solid #99f6e4;border-radius:12px;background:#f0fdfa;text-align:center;color:#115e59;font-size:32px;font-weight:700;letter-spacing:8px">${code}</div>
        <p style="margin:0 0 14px;color:#475569;line-height:1.6">This code expires in ${expiresInMinutes} minutes. Do not share it with anyone; ${safeName} will never ask you to share it.</p>
        <p style="margin:0;color:#475569;line-height:1.6">If you did not request a password reset, you can ignore this email.</p>
      </td></tr>
      <tr><td style="padding:18px 30px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6">Need help? Contact <a href="mailto:${safeSupport}" style="color:#0f766e">${safeSupport}</a>.</td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    text: `${appName}\n\nReset your password\n\nYour one-time password reset code is: ${code}\n\nThis code expires in ${expiresInMinutes} minutes. Do not share it with anyone. If you did not request this reset, ignore this email.\nSupport: ${supportEmail}`
  }, sender, context, 'password-reset');
}

export async function sendPasswordChangedEmail(
  to: string,
  sender: AuthEmailSender = sendWithResend,
  context: VerificationEmailContext = {},
): Promise<{ messageId: string }> {
  if (!recipientEmailSchema.safeParse(to).success) throw new AuthError('A valid recipient email address is required.', 400);
  assertEmailDeliveryConfigured();
  const from = process.env.OTP_FROM_EMAIL;
  if (!from) throw emailConfigurationError();
  const appName = process.env.APP_NAME || 'SKILLBRIDGE ET';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@skillbridge.et';
  const safeName = escapeHtml(appName);
  const safeSupport = escapeHtml(supportEmail);
  return sendConfiguredEmail(to, {
    from,
    to,
    subject: `Your ${appName} password was changed`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 12px;background:#f1f5f9"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e2e8f0;border-radius:16px">
      <tr><td style="padding:26px 30px;background:#10263d;color:#fff;font-size:18px;font-weight:700">${safeName}</td></tr>
      <tr><td style="padding:32px 30px"><h1 style="margin:0 0 12px;font-size:24px">Your password was changed</h1>
        <p style="margin:0 0 14px;color:#475569;line-height:1.6">The password for your account was successfully updated. For your security, all previous sign-in sessions have been signed out.</p>
        <p style="margin:0;color:#475569;line-height:1.6">If you did not make this change, contact support immediately at <a href="mailto:${safeSupport}" style="color:#0f766e">${safeSupport}</a>.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`,
    text: `${appName}\n\nThe password for your account was successfully updated. All previous sign-in sessions have been signed out.\n\nIf you did not make this change, contact support immediately at ${supportEmail}.`
  }, sender, context, 'password-changed');
}
