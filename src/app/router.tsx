import React from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './providers/AuthContext';
import { useAiNexus } from './providers/AiNexusContext';
import { ThemeScopeRoot } from './providers/ThemeContext';
import { Header } from '@/src/components/navigation/Header';
import { Footer } from '@/src/components/shared/Footer';
import { AiNexusDrawer } from '@/src/components/ai/AiNexusDrawer';
import { AiNexusLauncher } from '@/src/components/ai/AiNexusLauncher';
import { BackButton } from '@/src/components/navigation/BackButton';
import { LandingPage } from '@/src/pages/LandingPage';
import { JobListingsPage } from '@/src/features/jobs/pages/JobListingsPage';
import { JobDetailsPage } from '@/src/features/jobs/pages/JobDetailsPage';
import { JobSeekerDashboard } from '@/src/features/candidates/pages/JobSeekerDashboard';
import { EmployerDashboard } from '@/src/features/employers/pages/EmployerDashboard';
const AdminDashboard = React.lazy(() => import('@/src/features/admin/pages/AdminDashboard').then(({ AdminDashboard: page }) => ({ default: page })));
import { CareerSkillsPage } from '@/src/features/skills/pages/CareerSkillsPage';
import { AboutPage } from '@/src/pages/AboutPage';
import { ContactPage } from '@/src/pages/ContactPage';
import { AuthPage } from '@/src/features/auth/pages/AuthPage';
import { VerifyEmailPage } from '@/src/features/auth/pages/VerifyEmailPage';
import { ReportVerificationPage } from '@/src/features/reports/pages/ReportVerificationPage';
import { ForgotPasswordPage, ResetPasswordPage } from '@/src/features/auth/pages/PasswordRecoveryPages';
import { AccountProfilePage } from '@/src/features/auth/pages/AccountProfilePage';
import { AiNexusPage } from '@/src/features/ai-nexus/pages/AiNexusPage';
import { Job, Role } from '@/shared/types';
import { api } from '@/src/services/api-client';

export const ROLE_DASHBOARD_PATHS: Record<Role, string> = {
  JOB_SEEKER: '/dashboard/seeker',
  EMPLOYER: '/dashboard/employer',
  ADMIN: '/admin',
};

function ProtectedRoute({ requiredRole, children }: { requiredRole?: Role; children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600 dark:text-slate-300" role="status">Checking account access…</div>;
  }
  if (!user) return <Navigate to="/auth?mode=login" replace />;
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={ROLE_DASHBOARD_PATHS[user.role] ?? '/auth?mode=login'} replace />;
  }
  return <>{children}</>;
}

function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setCurrentRoute } = useAiNexus();
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = React.useState(true);
  const [jobsError, setJobsError] = React.useState<string | null>(null);
  const [searchResults, setSearchResults] = React.useState<Job[] | null>(null);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [searchParams, setSearchParams] = React.useState<{ q?: string; city?: string }>({});

  const normalizeRoute = React.useCallback((path: string) => {
    const normalized = path === '/' ? 'landing' : path;
    if (normalized.startsWith('/jobs/')) return 'job-detail';
    if (normalized === '/jobs') return 'jobs';
    if (normalized === '/dashboard/seeker') return 'seeker-dashboard';
    if (normalized === '/dashboard/employer') return 'employer-dashboard';
    if (normalized === '/admin') return 'admin-dashboard';
    if (normalized === '/skills') return 'career-skills';
    if (normalized === '/ai') return 'ai-nexus';
    if (normalized === '/about') return 'about';
    if (normalized === '/contact') return 'contact';
    if (normalized === '/auth') return 'auth';
    if (normalized === '/verify-email') return 'verify-email';
    if (normalized.startsWith('/verify-report/')) return 'report-verification';
    if (normalized === '/account/security') return 'account-security';
    if (normalized === '/account/profile' || normalized === '/account/settings') return 'account-profile';
    return normalized.replace('/', '').replace(/\//g, '-') || 'landing';
  }, []);

  React.useEffect(() => {
    setCurrentRoute(normalizeRoute(location.pathname));
  }, [location.pathname, normalizeRoute, setCurrentRoute]);

  const refreshJobs = React.useCallback(async () => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      setJobs(await api.getJobs());
    } catch {
      setJobsError('Open opportunities could not be loaded. Please try again.');
    } finally {
      setJobsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshJobs();
  }, [refreshJobs]);

  const navigateTo = React.useCallback((page: string, params: Record<string, string> = {}) => {
    const backFrom = `${location.pathname}${location.search}${location.hash}`;
    const navigateInternally = (path: string, state: Record<string, unknown> = {}) => {
      navigate(path, { state: { ...state, backFrom } });
    };
    const routeMap: Record<string, string> = {
      landing: '/',
      jobs: '/jobs',
      'job-detail': '/jobs/' + (params.jobId || ''),
      'seeker-dashboard': '/dashboard/seeker',
      'employer-dashboard': '/dashboard/employer',
      'admin-dashboard': '/admin',
      'career-skills': '/skills',
      'ai-nexus': '/ai',
      about: '/about',
      contact: '/contact',
      auth: '/auth',
      'verify-email': '/verify-email',
      'account-security': '/account/security',
      'account-profile': '/account/profile',
      'account-settings': '/account/profile#privacy',
    };

    const target = routeMap[page] || '/';
    if (page === 'jobs' && Object.keys(params).length === 0) {
      setSearchParams({});
      setSearchResults(null);
    }
    if (Object.keys(params).length > 0 && page === 'job-detail') {
      navigateInternally(`/jobs/${params.jobId}`);
      return;
    }
    if (page === 'seeker-dashboard' && params.tab) {
      navigateInternally(`/dashboard/seeker?tab=${encodeURIComponent(params.tab)}`);
      return;
    }
    if (page === 'employer-dashboard' && params.section) {
      navigateInternally(`/dashboard/employer?section=${encodeURIComponent(params.section)}`);
      return;
    }
    if (Object.keys(params).length > 0 && page === 'auth') {
      const mode = params.mode === 'signup' ? 'signup' : 'login';
      navigateInternally(`/auth?mode=${mode}`);
      return;
    }
    if (page === 'admin-dashboard' && params.section) {
      navigateInternally(`/admin?section=${encodeURIComponent(params.section)}`);
      return;
    }
    if (page === 'account-profile' && params.edit === 'true') {
      navigateInternally('/account/profile?edit=true');
      return;
    }
    navigateInternally(target);
  }, [location.hash, location.pathname, location.search, navigate]);

  const handleHeroSearch = async (params: { q?: string; city?: string }) => {
    const filters = {
      q: params.q?.trim() || undefined,
      city: params.city && params.city !== 'All' ? params.city : undefined
    };
    setSearchParams(filters);
    setSearchResults(null);
    setSearchError(null);
    setSearchLoading(true);
    try {
      setSearchResults(await api.getJobs(filters));
      navigate('/jobs', { state: { backFrom: `${location.pathname}${location.search}${location.hash}` } });
    } catch {
      setSearchError('Job search is temporarily unavailable. Please try again.');
    } finally {
      setSearchLoading(false);
    }
  };

  const currentPage = normalizeRoute(location.pathname);
  const isAuthPage = location.pathname === '/auth';
  const isVerificationPage = location.pathname === '/verify-email';
  const isPasswordRecoveryPage = ['/forgot-password', '/reset-password'].includes(location.pathname);
  const isSeekerDashboard = location.pathname === '/dashboard/seeker';
  const isEmployerDashboard = location.pathname === '/dashboard/employer';
  const isAccountProfilePage = ['/account/profile', '/account/settings'].includes(location.pathname);
  const isAdminRoute = location.pathname === '/admin';
  const hasShellBackButton = location.pathname === '/auth';

  return (
    <ThemeScopeRoot className="min-h-screen flex flex-col bg-app-background text-app-text font-sans relative">
      {!isAuthPage && !isVerificationPage && !isPasswordRecoveryPage && !isAdminRoute && <Header currentPage={currentPage} onNavigate={navigateTo} />}
      {hasShellBackButton && (
        <div className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
          <BackButton
            fallbackTo="/"
            fallbackLabel="Back to Home"
            className="min-h-11 touch-manipulation"
          />
        </div>
      )}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage jobs={jobs} jobsLoading={jobsLoading} jobsError={jobsError} onRetryJobs={refreshJobs} searchLoading={searchLoading} searchError={searchError} onNavigate={navigateTo} onSearch={handleHeroSearch} />} />
          <Route path="/jobs" element={<JobListingsPage jobs={searchResults ?? jobs} onNavigate={navigateTo} initialQuery={searchParams.q || ''} initialCity={searchParams.city || 'All'} />} />
          <Route path="/jobs/:jobId" element={<JobDetailsPage jobId={location.pathname.split('/jobs/')[1] || (jobs[0]?.id ?? 'job-1')} onNavigate={navigateTo} />} />
          <Route path="/dashboard/seeker" element={<ProtectedRoute requiredRole="JOB_SEEKER"><JobSeekerDashboard onNavigate={navigateTo} /></ProtectedRoute>} />
          <Route path="/dashboard/employer" element={<ProtectedRoute requiredRole="EMPLOYER"><EmployerDashboard onNavigate={navigateTo} /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requiredRole="ADMIN"><React.Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600 dark:text-slate-300" role="status">Loading governance workspace…</div>}><AdminDashboard onNavigate={navigateTo} /></React.Suspense></ProtectedRoute>} />
          <Route path="/account/security" element={<ProtectedRoute><Navigate to="/account/profile#security" replace /></ProtectedRoute>} />
          <Route path="/account/profile" element={<ProtectedRoute><AccountProfilePage /></ProtectedRoute>} />
          <Route path="/account/settings" element={<ProtectedRoute><AccountProfilePage /></ProtectedRoute>} />
          <Route path="/skills" element={<CareerSkillsPage onNavigate={navigateTo} />} />
          <Route path="/ai" element={<AiNexusPage onNavigate={navigateTo} />} />
          <Route path="/about" element={<AboutPage onNavigate={navigateTo} />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route
            path="/auth"
            element={<AuthPage initialMode={(new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login')} onNavigate={navigateTo} />}
          />
          <Route path="/verify-email" element={<VerifyEmailPage onNavigate={navigateTo} />} />
          <Route path="/verify-report/:reportId" element={<ReportVerificationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!isAuthPage && !isVerificationPage && !isPasswordRecoveryPage && !isAdminRoute && !isSeekerDashboard && !isEmployerDashboard && !isAccountProfilePage && <Footer onNavigate={navigateTo} />}
      {!isAuthPage && !isVerificationPage && !isPasswordRecoveryPage && location.pathname !== '/ai' && <AiNexusLauncher currentRoute={currentPage} />}
      {!isAuthPage && !isVerificationPage && !isPasswordRecoveryPage && <AiNexusDrawer onNavigate={navigateTo} />}
    </ThemeScopeRoot>
  );
}

export default function AppRouter() {
  return <AppLayout />;
}
