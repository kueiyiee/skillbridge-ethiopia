import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, CheckCircle2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/src/components/shared/BrandLogo';
import { ThemeSwitcher } from '@/src/components/navigation/ThemeSwitcher';
import { api } from '@/src/services/api-client';
import { BackButton } from '@/src/components/navigation/BackButton';

const inputClassName = 'auth-input';
const buttonClassName = 'auth-primary-button w-full';
const publicRequestMessage = 'If an eligible account exists, check its inbox and spam folder for a reset code. If no code arrives, wait briefly before requesting another.';

function PasswordRecoveryShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <BrandLogo size="md" />
        <ThemeSwitcher />
      </div>
      <div className="mx-auto grid min-h-[calc(100vh-6rem)] w-full max-w-6xl items-center gap-10 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.75fr)] lg:gap-20">
        <section className="hidden lg:block">
          <div className="auth-muted mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]">
            <span className="h-px w-7 bg-app-border-strong" />
            Secure account recovery
          </div>
          <h1 className="auth-heading max-w-xl text-4xl font-bold leading-tight xl:text-5xl">
            Keep your next opportunity within reach.
          </h1>
          <p className="auth-copy mt-5 max-w-lg text-base leading-7">
            Bridging Talent to Opportunity Through Verified Skills.
          </p>
          <div className="auth-copy mt-8 inline-flex items-center gap-2 rounded-full border border-app-border bg-app-surface-secondary px-4 py-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-app-text-primary" aria-hidden="true" />
            Secure, private password recovery
          </div>
        </section>
        <section className="auth-card mx-auto w-full max-w-lg rounded-2xl p-5 sm:p-8">
          {children}
        </section>
      </div>
    </div>
  );
}

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));

  const requestCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await api.requestPasswordReset(email.trim());
      setSubmitted(true);
      setResendAt(Date.now() + 60_000);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not process the request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (loading || resendSeconds > 0) return;
    setLoading(true);
    setError(null);
    try {
      await api.resendPasswordResetCode(email.trim());
      setResendAt(Date.now() + 60_000);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not process the request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PasswordRecoveryShell>
      <BackButton fallbackTo="/auth?mode=login" fallbackLabel="Back to Sign In" />
      {submitted ? (
        <div className="mt-8" aria-live="polite">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-app-border bg-app-surface-secondary text-app-text-primary">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="auth-heading mt-5 text-2xl font-bold">Check your email</h1>
          <p className="auth-copy mt-3 text-sm leading-6">{publicRequestMessage}</p>
          <p className="mt-2 break-all text-sm font-semibold text-app-text-primary">{email}</p>
          <button
            type="button"
            onClick={() => navigate('/reset-password', { state: { email } })}
            className={`${buttonClassName} mt-7`}
          >
            Enter reset code
          </button>
          <button
            type="button"
            onClick={() => void resendCode()}
            disabled={loading || resendSeconds > 0}
            className="auth-muted mt-4 min-h-10 w-full rounded-lg px-3 text-sm font-semibold underline-offset-4 hover:text-app-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus disabled:cursor-not-allowed disabled:no-underline"
          >
            {loading ? 'Requesting…' : resendSeconds > 0 ? `Request another code in ${resendSeconds}s` : 'Request another code'}
          </button>
          {error && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200" role="alert">{error}</p>}
        </div>
      ) : (
        <>
          <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl border border-app-border bg-app-surface-secondary text-app-text-primary">
            <Lock className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="auth-heading mt-5 text-2xl font-bold">Forgot your password?</h1>
          <p className="auth-copy mt-3 text-sm leading-6">
            Enter the email address associated with your account. If an eligible account exists, we’ll send instructions to reset your password.
          </p>
          <form onSubmit={requestCode} className="mt-7 space-y-5" aria-busy={loading}>
            <div className="space-y-1.5">
              <label htmlFor="recovery-email" className="auth-label block text-sm font-semibold">Email address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" aria-hidden="true" />
                <input
                  id="recovery-email"
                  name="email"
                  type="email"
                  required
                  maxLength={191}
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={`${inputClassName} auth-input-icon`}
                />
              </div>
            </div>
            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200" role="alert">{error}</p>}
            <button type="submit" disabled={loading} className={buttonClassName}>
              {loading ? 'Sending request…' : 'Send Reset Code'}
            </button>
          </form>
        </>
      )}
    </PasswordRecoveryShell>
  );
};

export const ResetPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const stateEmail = (location.state as { email?: string } | null)?.email;
  const [email, setEmail] = useState(stateEmail || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendAt, setResendAt] = useState(() => Date.now() + 60_000);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const resendSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const passwordBytes = new TextEncoder().encode(newPassword).length;
  const hasMinimumLength = newPassword.length >= 12;
  const fitsPasswordLimit = passwordBytes <= 72;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await api.resetPassword({ email: email.trim(), code, newPassword, confirmPassword });
      setCode('');
      setNewPassword('');
      setConfirmPassword('');
      setComplete(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Password reset failed. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (loading || resendSeconds > 0 || !email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await api.resendPasswordResetCode(email.trim());
      setResendAt(Date.now() + 60_000);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'We could not request another code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PasswordRecoveryShell>
      <BackButton fallbackTo="/auth?mode=login" fallbackLabel="Back to Sign In" />
      {complete ? (
        <div className="mt-8" role="status" aria-live="polite">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-app-border bg-app-surface-secondary text-app-text-primary">
            <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="auth-heading mt-5 text-2xl font-bold">Password reset complete</h1>
          <p className="auth-copy mt-3 text-sm leading-6">
            Your password was updated and existing sessions were signed out. Sign in with your new password.
          </p>
          <Link to="/auth?mode=login" className={`${buttonClassName} mt-7`}>Return to Sign In</Link>
        </div>
      ) : (
        <>
          <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl border border-app-border bg-app-surface-secondary text-app-text-primary">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="auth-heading mt-5 text-2xl font-bold">Set a new password</h1>
          <p className="auth-copy mt-3 text-sm leading-6">
            Enter the six-digit code from your reset email and choose a new password.
          </p>
          <form onSubmit={handleSubmit} className="mt-7 space-y-4" aria-busy={loading}>
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="auth-label block text-sm font-semibold">Registered email address</label>
              <input id="reset-email" type="email" required maxLength={191} autoComplete="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reset-code" className="auth-label block text-sm font-semibold">Six-digit reset code</label>
              <input
                id="reset-code"
                name="one-time-code"
                type="text"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                aria-describedby="reset-code-help"
                placeholder="000000"
                className={`${inputClassName} tracking-[0.35em]`}
              />
              <p id="reset-code-help" className="auth-muted text-xs">Paste the code from your email. It expires after a short time.</p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reset-new-password" className="auth-label block text-sm font-semibold">New password</label>
              <div className="relative">
                <input id="reset-new-password" type={showNewPassword ? 'text' : 'password'} required minLength={12} maxLength={72} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} aria-describedby="reset-password-requirements" className={`${inputClassName} auth-input-password`} />
                <button type="button" onClick={() => setShowNewPassword((visible) => !visible)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'} aria-pressed={showNewPassword} className="auth-muted absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md hover:bg-app-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-focus">
                  <span className="text-[10px] font-semibold">{showNewPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="reset-confirm-password" className="auth-label block text-sm font-semibold">Confirm new password</label>
              <div className="relative">
                <input id="reset-confirm-password" type={showConfirmPassword ? 'text' : 'password'} required minLength={12} maxLength={72} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={`${inputClassName} auth-input-password`} />
                <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'} aria-pressed={showConfirmPassword} className="auth-muted absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md hover:bg-app-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-focus">
                  <span className="text-[10px] font-semibold">{showConfirmPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>
            <div id="reset-password-requirements" className="auth-copy space-y-1.5 border-l-2 border-app-border pl-3 text-xs">
              <p className={`flex items-center gap-2 ${hasMinimumLength ? 'text-teal-800 dark:text-teal-300' : ''}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />At least 12 characters</p>
              <p className={`flex items-center gap-2 ${fitsPasswordLimit ? 'text-teal-800 dark:text-teal-300' : 'text-rose-700 dark:text-rose-300'}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />No more than 72 UTF-8 bytes</p>
              <p className={`flex items-center gap-2 ${passwordsMatch ? 'text-teal-800 dark:text-teal-300' : ''}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />Both passwords match</p>
            </div>
            {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200" role="alert" aria-live="polite">{error}</p>}
            <button type="submit" disabled={loading || code.length !== 6 || !hasMinimumLength || !fitsPasswordLimit || !passwordsMatch} className={buttonClassName}>
              {loading ? 'Resetting password…' : 'Verify Code and Reset Password'}
            </button>
            <button
              type="button"
              onClick={() => void resendCode()}
              disabled={loading || resendSeconds > 0 || !email.trim()}
              className="auth-muted min-h-10 w-full rounded-lg px-3 text-sm font-semibold underline-offset-4 hover:text-app-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus disabled:cursor-not-allowed disabled:no-underline"
            >
              {loading ? 'Please wait…' : resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend Code'}
            </button>
          </form>
        </>
      )}
    </PasswordRecoveryShell>
  );
};
