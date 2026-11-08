import type { ReactNode } from 'react';

export function DashboardLayout({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_1fr]">{children}</div>;
}
