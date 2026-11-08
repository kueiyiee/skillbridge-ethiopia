import type { ReactNode } from 'react';
import { RouteGuard } from './route-guards';
import { AiNexusPage } from '../features/ai-assistant';

type RouteConfig = {
  path: string;
  element: ReactNode;
  guard?: 'guest' | 'auth' | 'employer' | 'candidate' | 'admin';
};

const routes: RouteConfig[] = [
  { path: '/', element: <div>Landing page</div> },
  { path: '/login', element: <div>Login page</div>, guard: 'guest' },
  { path: '/register', element: <div>Register page</div>, guard: 'guest' },
  { path: '/jobs', element: <div>Jobs page</div> },
  { path: '/dashboard', element: <div>Dashboard</div>, guard: 'auth' },
  { path: '/admin', element: <div>Admin dashboard</div>, guard: 'admin' },
  { path: '/ai-assistant', element: <AiNexusPage /> },
];

export function RouterProvider() {
  const currentPath = window.location.pathname || '/';
  const matchedRoute = routes.find((route) => route.path === currentPath) ?? routes[0];

  return (
    <RouteGuard guard={matchedRoute.guard}>
      {matchedRoute.element}
    </RouteGuard>
  );
}
