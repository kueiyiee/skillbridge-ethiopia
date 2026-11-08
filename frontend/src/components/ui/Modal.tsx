import type { ReactNode } from 'react';

export function Modal({ open, title, children }: { open: boolean; title?: string; children: ReactNode }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {title ? <h3 className="mb-4 text-lg font-semibold text-slate-900">{title}</h3> : null}
        {children}
      </div>
    </div>
  );
}
