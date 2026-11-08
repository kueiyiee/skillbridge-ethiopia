import type { ReactNode } from 'react';
import { useAppContext } from './providers';

type GuardType = 'guest' | 'auth' | 'employer' | 'candidate' | 'admin';

export function RouteGuard({
  guard,
  children,
}: {
  guard?: GuardType;
  children: ReactNode;
}) {
  const { isAuthenticated, user } = useAppContext();

  if (!guard) return <>{children}</>;

  if (guard === 'guest' && isAuthenticated) {
    return <div>Redirecting to dashboard...</div>;
  }

  if (guard === 'auth' && !isAuthenticated) {
    return <div>Please sign in to access this page.</div>;
  }

  if (guard === 'employer' && (!isAuthenticated || user?.role !== 'employer')) {
    return <div>Employer access required.</div>;
  }

  if (guard === 'candidate' && (!isAuthenticated || user?.role !== 'candidate')) {
    return <div>Candidate access required.</div>;
  }

  if (guard === 'admin' && (!isAuthenticated || user?.role !== 'admin')) {
    return <div>Administrator access required.</div>;
  }

  return <>{children}</>;
}
