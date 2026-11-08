import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/src/app/providers/AuthContext';
import { RegistrationRole, Role } from '@/shared/types';
import { BrandLogo } from '@/src/components/shared/BrandLogo';
import { ThemeSwitcher } from '@/src/components/navigation/ThemeSwitcher';
import { api } from '@/src/services/api-client';
import {
  ArrowRight,
  Building2,
  Lock,
  Mail,
  User
} from 'lucide-react';

interface AuthPageProps {
  initialMode?: 'login' | 'signup';
  onNavigate: (page: string) => void;
}

const roleOptions: { role: RegistrationRole; title: string; description: string; icon: typeof User }[] = [
  { role: 'JOB_SEEKER', title: 'Job Seeker', description: 'Discover jobs and showcase your skills.', icon: User },
  { role: 'EMPLOYER', title: 'Employer', description: 'Find talent and manage vacancies.', icon: Building2 }
];

const dashboardForRole = (role: Role) => {
  if (role === 'EMPLOYER') return 'employer-dashboard';
  if (role === 'ADMIN') return 'admin-dashboard';
  return 'seeker-dashboard';
};

const errorText = (error: unknown) => {
  if (error instanceof TypeError) return 'We could not reach the server. Check your connection and try again.';
  return error instanceof Error ? error.message : 'We could not complete that request. Please try again.';
};

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = 'login', onNavigate }) => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [selectedRole, setSelectedRole] = useState<RegistrationRole>('JOB_SEEKER');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyOrSchool, setCompanyOrSchool] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verificationPending, setVerificationPending] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [requestingVerification, setRequestingVerification] = useState(false);

  useEffect(() => {
    setIsLogin(initialMode === 'login');
  }, [initialMode]);

  const switchMode = (nextIsLogin: boolean) => {
    setIsLogin(nextIsLogin);
    setErrorMessage(null);
    setVerificationPending(false);
    setNeedsVerification(false);
  };

  const handleRequestVerification = async () => {
    const address = email.trim();
    if (!address) {
      setErrorMessage('Enter the email address you used to register.');
      return;
    }
    setErrorMessage(null);
    setRequestingVerification(true);
    try {
      await api.requestEmailVerification(address);
      onNavigate('verify-email');
    } catch (error) {
      setErrorMessage(errorText(error));
    } finally {
      setRequestingVerification(false);
    }
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    if (!isLogin && password !== confirmPassword) {
      setErrorMessage('Your passwords do not match. Please check both fields.');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const authenticatedRole = await login(email.trim(), password);
        onNavigate(dashboardForRole(authenticatedRole));
      } else {
        await register({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            role: selectedRole,
            companyOrSchool: companyOrSchool.trim()
          });
        onNavigate('verify-email');
      }
    } catch (error) {
      setErrorMessage(errorText(error));
      setVerificationPending(Boolean(error && typeof error === 'object' && 'verificationPending' in error && error.verificationPending === true));
      setNeedsVerification(error instanceof Error && error.message.includes('Verify your email address'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page flex flex-col px-4 py-5 sm:px-6 sm:py-7">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus"
          aria-label="SKILLBRIDGE home"
        >
          <BrandLogo size="md" showSubtitle={false} />
        </button>
        <ThemeSwitcher />
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 py-7 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,32rem)] lg:gap-16 lg:py-10">
        <aside className="hidden max-w-xl lg:block">
          <p className="auth-muted text-xs font-bold uppercase tracking-[0.16em]">Skills-first careers in Ethiopia</p>
          <h2 className="auth-heading mt-4 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Find opportunity through the skills you bring.
          </h2>
          <p className="auth-copy mt-5 max-w-lg text-base leading-7">
            Bridging Talent to Opportunity Through Verified Skills.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-app-border bg-app-surface-secondary text-app-text-primary">
              <User className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="auth-copy text-sm">Create a profile that makes your skills visible.</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-app-border bg-app-surface-secondary text-app-text-primary">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="auth-copy text-sm">Connect employers with relevant talent.</span>
          </div>
        </aside>

        <div className="w-full">
        <section className="auth-card mx-auto w-full max-w-lg rounded-2xl p-5 sm:p-8">
          <div className="w-full">
          <div className="mb-6">
            <h1 className="auth-heading text-2xl font-bold tracking-tight sm:text-3xl">
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="auth-copy mt-2 text-sm leading-6">
              {isLogin ? 'Sign in to continue to your SKILLBRIDGE account.' : 'Create an account to find or share opportunities.'}
            </p>
          </div>

          <div className="auth-segmented-control mb-6 grid grid-cols-2" role="group" aria-label="Choose sign-in or registration">
            <button
              type="button"
              aria-pressed={isLogin}
              disabled={loading}
              onClick={() => switchMode(true)}
              className="min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus disabled:cursor-not-allowed"
            >Sign In</button>
            <button
              type="button"
              aria-pressed={!isLogin}
              disabled={loading}
              onClick={() => switchMode(false)}
              className="min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus disabled:cursor-not-allowed"
            >Create Account</button>
          </div>

          <form key={isLogin ? 'login' : 'signup'} onSubmit={handleFormSubmit} className="auth-mode-enter space-y-5" aria-busy={loading}>
            {!isLogin && (
              <fieldset className="space-y-2.5">
                <legend className="auth-label text-sm font-semibold">Choose your account type</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {roleOptions.map(({ role, title, description, icon: Icon }) => {
                  const selected = selectedRole === role;
                  return (
                    <label key={role} className="group relative block cursor-pointer">
                      <input
                        type="radio"
                        name="account-role"
                        value={role}
                        checked={selected}
                        onChange={() => setSelectedRole(role)}
                        className="peer sr-only"
                      />
                      <span className={`auth-role-card flex min-h-[92px] h-full gap-2.5 rounded-xl p-3 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-app-focus ${selected ? 'is-selected' : 'hover:bg-app-surface-secondary'}`}>
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-app-border bg-app-surface-secondary text-app-text-primary">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-app-text-primary">{title}</span>
                          <span className="auth-muted mt-1 block text-xs leading-4">{description}</span>
                        </span>
                      </span>
                    </label>
                  );
                  })}
                </div>
                <p className="auth-muted text-xs leading-4">
                  Employer verification follows registration.
                </p>
              </fieldset>
            )}

            {errorMessage && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200" role="alert" aria-live="polite">
                {errorMessage}
              </div>
            )}
            {verificationPending && (
              <button
                type="button"
                disabled={requestingVerification}
                onClick={() => void handleRequestVerification()}
                className="auth-secondary-button"
              >
                {requestingVerification ? 'Requesting code…' : 'Request a verification code'} {!requestingVerification && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            )}
            {needsVerification && (
              <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">This email still needs verification.</p>
                <p className="text-xs leading-5">Request a fresh code to the address above. For privacy, we use the same confirmation message whether or not an account needs verification.</p>
                <button
                  type="button"
                  disabled={requestingVerification}
                  onClick={() => void handleRequestVerification()}
                  className="auth-primary-button"
                >
                  {requestingVerification ? 'Requesting code…' : 'Request a verification code'}
                  {!requestingVerification && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            )}

            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="auth-full-name" className="auth-label block text-sm font-semibold">Full name</label>
                <input
                  id="auth-full-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="e.g. Yohannes Bekele"
                  className="auth-input"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="auth-label block text-sm font-semibold">{isLogin ? 'Email or username' : 'Email address'}</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" aria-hidden="true" />
                <input
                  id="auth-email"
                  type={isLogin ? 'text' : 'email'}
                  required
                  autoComplete={isLogin ? 'username' : 'email'}
                  inputMode={isLogin ? undefined : 'email'}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={isLogin ? 'Email or username' : 'you@example.com'}
                  className="auth-input auth-input-icon"
                />
              </div>
            </div>

              <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="auth-password" className="auth-label block text-sm font-semibold">Password</label>
                {isLogin && (
                  <Link
                    to="/forgot-password"
                    className="rounded text-xs font-semibold text-app-link underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-muted" aria-hidden="true" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={isLogin ? undefined : 8}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isLogin ? 'Enter your password' : 'At least 8 characters'}
                  aria-describedby={!isLogin ? 'auth-password-help' : undefined}
                  className="auth-input auth-input-icon auth-input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="auth-muted absolute right-1.5 top-1/2 flex h-9 min-w-10 -translate-y-1/2 items-center justify-center rounded-md px-1 transition hover:bg-app-surface-hover hover:text-app-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-focus"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  <span className="text-[10px] font-semibold">{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              {!isLogin && <p id="auth-password-help" className="auth-muted text-xs">Use at least 8 characters. Passwords are kept private.</p>}
            </div>

            {!isLogin && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="auth-confirm-password" className="auth-label block text-sm font-semibold">Confirm password</label>
                  <input
                    id="auth-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="auth-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="auth-company" className="auth-label block text-sm font-semibold">
                    {selectedRole === 'EMPLOYER' ? 'Company name (optional)' : 'School or institution (optional)'}
                  </label>
                  <input
                    id="auth-company"
                    type="text"
                    autoComplete="organization"
                    value={companyOrSchool}
                    onChange={(event) => setCompanyOrSchool(event.target.value)}
                    placeholder={selectedRole === 'EMPLOYER' ? 'Your organization' : 'Your school or institution'}
                    className="auth-input"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="auth-primary-button w-full"
            >
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/25 border-t-current" aria-hidden="true" /> : null}
              <span>{loading ? (isLogin ? 'Signing in...' : 'Creating account...') : (isLogin ? 'Sign In' : 'Create Account')}</span>
              {!loading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </form>
        </div>
        </section>
        <footer className="auth-muted mt-4 flex justify-center gap-5 text-xs">
          <button type="button" onClick={() => onNavigate('about')} className="rounded hover:text-app-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-focus">Privacy &amp; data</button>
          <button type="button" onClick={() => onNavigate('contact')} className="rounded hover:text-app-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-focus">Help &amp; support</button>
        </footer>
        </div>
      </div>
    </div>
  );
};
