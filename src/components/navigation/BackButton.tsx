import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  fallbackTo: string;
  fallbackLabel?: string;
  label?: string;
  onBeforeNavigate?: () => boolean;
  className?: string;
}

const allowedRoute = (path: unknown): path is string => {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return false;
  if (/[\u0000-\u001f\\]/.test(path)) return false;
  const pathname = path.split(/[?#]/, 1)[0];
  return [
    '/',
    '/jobs',
    '/skills',
    '/ai',
    '/about',
    '/contact',
    '/auth',
    '/verify-email',
    '/forgot-password',
    '/reset-password',
    '/account/profile',
    '/account/settings',
    '/account/security',
    '/dashboard/seeker',
    '/dashboard/employer',
    '/admin',
  ].includes(pathname) || /^\/jobs\/[A-Za-z0-9_-]+$/.test(pathname);
};

const routeLabel = (path: string, fallback: string) => {
  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname === '/jobs' || pathname.startsWith('/jobs/')) return 'Back to Jobs';
  if (pathname.startsWith('/account/')) return 'Back to Profile';
  if (pathname === '/dashboard/seeker') return 'Back to Dashboard';
  if (pathname === '/dashboard/employer' || pathname === '/admin') return 'Back to Dashboard';
  if (pathname === '/auth') return 'Back to Sign In';
  if (pathname === '/forgot-password') return 'Back to Password Recovery';
  if (pathname === '/skills') return 'Back to Skills';
  return fallback;
};

export const BackButton: React.FC<BackButtonProps> = ({
  fallbackTo,
  fallbackLabel = 'Back',
  label: labelOverride,
  onBeforeNavigate,
  className = '',
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { backFrom?: unknown } | null;
  const candidateBackFrom = allowedRoute(locationState?.backFrom) ? locationState.backFrom : null;
  const backFrom = candidateBackFrom?.split(/[?#]/, 1)[0] === location.pathname ? null : candidateBackFrom;
  const fallback = allowedRoute(fallbackTo) ? fallbackTo : '/';
  const historyIndex = window.history.state?.idx;
  const hasInAppHistory = Number.isInteger(historyIndex) && historyIndex > 0;
  const label = labelOverride || (backFrom ? routeLabel(backFrom, fallbackLabel) : fallbackLabel);

  const handleClick = () => {
    if (onBeforeNavigate && !onBeforeNavigate()) return;

    if (hasInAppHistory) {
      navigate(-1);
      return;
    }

    navigate(backFrom || fallback, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-2.5 text-sm font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white dark:active:bg-slate-700 ${className}`}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
};
