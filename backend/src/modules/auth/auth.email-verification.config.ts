import { AuthError } from './auth.errors';

export function getEmailOtpTtlMinutes(): number {
  const configured = process.env.EMAIL_OTP_TTL_MINUTES;
  if (!configured) return 10;
  const minutes = Number(configured);
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 30) {
    throw new AuthError('EMAIL_OTP_TTL_MINUTES must be a whole number between 5 and 30.', 503);
  }
  return minutes;
}
