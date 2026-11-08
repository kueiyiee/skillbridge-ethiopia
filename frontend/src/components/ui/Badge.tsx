import type { ReactNode } from 'react';

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800 ${className}`}>{children}</span>;
}
