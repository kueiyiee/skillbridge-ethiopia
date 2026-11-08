import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthContext';
import { BrandLogo } from '@/src/components/shared/BrandLogo';
import { ThemeSwitcher } from '@/src/components/navigation/ThemeSwitcher';
import { BackButton } from '@/src/components/navigation/BackButton';
import { api } from '@/src/services/api-client';
import type { Role } from '@/shared/types';

interface VerifyEmailPageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

interface VerificationStatus {
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
}

const dashboardForRole = (role: Role) => {
  if (role === 'EMPLOYER') return 'employer-dashboard';
  if (role === 'ADMIN') return 'admin-dashboard';
  return 'seeker-dashboard';
};

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({ onNavigate }) => {
  const { completeEmailVerification, user } = useAuth();
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const redirectTimer = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [canRequestVerification, setCanRequestVerification] = useState(false);
  const [requestEmail, setRequestEmail] = useState('');
  const [requestingVerification, setRequestingVerification] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [completeCode, setCompleteCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (user) {
      onNavigate(dashboardForRole(user.role));
      return;
    }
    let mounted = true;
    void api.getEmailVerificationStatus().then((verification) => {
      if (mounted) setStatus(verification);
    }).catch((error: unknown) => {
      if (!mounted) return;
      const message = error instanceof Error ? error.message : 'This verification session is unavailable.';
      setStatusError(message);
      setCanRequestVerification(message.toLowerCase().includes('verification session is unavailable'));
    });
    return () => {
      mounted = false;
      if (redirectTimer.current !== undefined) window.clearTimeout(redirectTimer.current);
    };
  }, [onNavigate, user]);

  useEffect(() => {
    if (status) inputs.current[0]?.focus();
  }, [status]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const resendSeconds = status
    ? Math.max(0, Math.ceil((new Date(status.resendAvailableAt).getTime() - now) / 1000))
    : 0;

  const updateCompleteState = () => {
    setCompleteCode(inputs.current.length === 6 && inputs.current.every((input) => Boolean(input?.value)));
  };

  const fillCodeInputs = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    inputs.current.forEach((input, index) => {
      if (input) input.value = digits[index] ?? '';
    });
    setCompleteCode(digits.length === 6);
    inputs.current[Math.min(digits.length, 5)]?.focus();
  };

  const handleInput = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length > 1) {
      fillCodeInputs(digits);
      return;
    }
    const input = inputs.current[index];
    if (!input) return;
    input.value = digits;
    updateCompleteState();
    if (digits && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading || !completeCode) return;
    const code = inputs.current.map((input) => input?.value ?? '').join('');
    setErrorMessage(null);
    setNotice(null);
    setLoading(true);
    try {
      const role = await completeEmailVerification(code);
      setVerified(true);
      redirectTimer.current = window.setTimeout(() => onNavigate(dashboardForRole(role)), 900);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'We could not verify your email. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending || resendSeconds > 0) return;
    setErrorMessage(null);
    setNotice(null);
    setResending(true);
    try {
      const result = await api.resendEmailVerificationCode();
      setStatus((current) => current ? { ...current, expiresAt: result.expiresAt, resendAvailableAt: result.resendAvailableAt } : current);
      fillCodeInputs('');
      setNotice(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'A new code could not be sent. Please try again.');
      setStatus((current) => current ? { ...current, resendAvailableAt: new Date(Date.now() + 60_000).toISOString() } : current);
    } finally {
      setResending(false);
    }
  };

  const handleRequestVerification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setNotice(null);
    setRequestingVerification(true);
    try {
      const result = await api.requestEmailVerification(requestEmail.trim());
      setNotice(result.message);
      try {
        const nextStatus = await api.getEmailVerificationStatus();
        setStatus(nextStatus);
        setStatusError(null);
        setCanRequestVerification(false);
      } catch (error) {
        setStatusError(error instanceof Error ? error.message : 'Verification status could not be loaded.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'A verification email could not be requested.');
    } finally {
      setRequestingVerification(false);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    fillCodeInputs(pasted);
  };

  return (
    <div className="auth-page flex min-h-screen items-center justify-center px-4 py-8 sm:px-6">
      <section className="auth-card w-full max-w-lg overflow-hidden rounded-2xl">
        <header className="flex items-center justify-between border-b border-app-border bg-app-surface-secondary px-5 py-4 text-app-text-primary sm:px-7">
          <BrandLogo size="md" />
          <ThemeSwitcher />
        </header>
        <div className="p-5 sm:p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-app-border bg-app-surface-secondary text-app-text-primary">
            {verified ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" /> : <Mail className="h-6 w-6" aria-hidden="true" />}
          </div>
          <p className="auth-muted text-xs font-bold uppercase tracking-[0.14em]">SKILLBRIDGE ET account security</p>
          <h1 className="auth-heading mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{verified ? 'Email verified' : 'Verify your email'}</h1>
          <p className="auth-copy mt-2 text-sm leading-6">
            {verified
              ? 'Your account is ready. Taking you to your dashboard…'
              : 'If your registration needs verification, enter the six-digit code sent to your email to activate your account.'}
          </p>

          {status && !verified && (
            <p className="auth-copy mt-5 flex items-center gap-2 rounded-lg border border-app-border bg-app-surface-secondary px-3 py-2.5 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-app-text-primary" aria-hidden="true" />
              <span>Verification email destination: <strong className="font-semibold">{status.email}</strong></span>
            </p>
          )}

          {canRequestVerification && !verified && (
            <form className="mt-5 space-y-3 rounded-xl border border-app-border bg-app-surface-secondary p-4" onSubmit={handleRequestVerification} aria-busy={requestingVerification}>
              <div>
                <h2 className="auth-heading text-sm font-semibold">Need a new verification session?</h2>
                <p className="auth-copy mt-1 text-xs leading-5">Enter the registration email. We’ll send a code if verification is needed.</p>
              </div>
              <label htmlFor="verification-email" className="sr-only">Registration email</label>
              <input
                id="verification-email"
                type="email"
                autoComplete="email"
                required
                maxLength={191}
                value={requestEmail}
                onChange={(event) => setRequestEmail(event.target.value)}
                placeholder="you@example.com"
                className="auth-input"
              />
              <button
                type="submit"
                disabled={requestingVerification}
                className="auth-primary-button w-full"
              >
                {requestingVerification ? 'Requesting code…' : 'Request verification code'}
                {!requestingVerification && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </form>
          )}

          {(statusError || errorMessage) && (
            <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm leading-5 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200" role="alert" aria-live="assertive">
              {statusError || errorMessage}
            </div>
          )}
          {notice && <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">{notice}</p>}
          {verified && <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" role="status">Verification complete. Your email is confirmed.</p>}

          {status && !verified && (
            <form className="mt-7 space-y-6" onSubmit={handleVerify} aria-busy={loading}>
              <fieldset>
                <legend className="auth-label mb-3 text-sm font-semibold">Verification code</legend>
                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                  {Array.from({ length: 6 }, (_, index) => (
                    <input
                      key={index}
                      ref={(element) => { inputs.current[index] = element; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      aria-label={`Verification digit ${index + 1}`}
                      onChange={(event) => handleInput(index, event.target.value)}
                      onPaste={handlePaste}
                      onKeyDown={(event) => {
                        if (event.key === 'Backspace') {
                          event.preventDefault();
                          const current = inputs.current[index];
                          if (current?.value) {
                            current.value = '';
                            updateCompleteState();
                          } else if (index > 0) {
                            const previous = inputs.current[index - 1];
                            if (previous) previous.value = '';
                            updateCompleteState();
                            previous?.focus();
                          }
                        } else if (event.key === 'ArrowLeft' && index > 0) {
                          event.preventDefault();
                          inputs.current[index - 1]?.focus();
                        } else if (event.key === 'ArrowRight' && index < 5) {
                          event.preventDefault();
                          inputs.current[index + 1]?.focus();
                        }
                      }}
                      disabled={loading}
                      className="auth-input auth-input-code h-12 min-w-0 text-center text-xl font-bold tabular-nums sm:h-14 sm:text-2xl"
                    />
                  ))}
                </div>
              </fieldset>
              <button
                type="submit"
                disabled={loading || !completeCode}
                className="auth-primary-button w-full"
              >
                {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />}
                {loading ? 'Verifying…' : 'Verify Email'}
                {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
              <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
                <button
                  type="button"
                  onClick={() => void handleResend()}
                  disabled={resending || resendSeconds > 0}
                  className="auth-muted min-h-10 rounded-md px-2 text-sm font-semibold underline-offset-4 hover:text-app-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-focus disabled:cursor-not-allowed disabled:no-underline"
                >
                  {resending ? 'Sending…' : resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend Code'}
                </button>
                <span className="auth-muted inline-flex items-center gap-1.5 text-xs"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Code valid until {new Date(status.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            </form>
          )}

          {!verified && (
            <div className="mt-7">
              <BackButton fallbackTo="/auth?mode=signup" fallbackLabel="Back to registration" label="Back to registration" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
