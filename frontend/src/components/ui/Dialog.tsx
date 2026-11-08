import type { ReactNode } from 'react';

export function Dialog({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">{children}</div>
    </div>
  );
}
