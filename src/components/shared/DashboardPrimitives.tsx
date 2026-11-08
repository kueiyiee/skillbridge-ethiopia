import React, { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface DashboardPageHeaderProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  titleId?: string;
  className?: string;
}

/**
 * Consistent page heading for role-specific dashboard workspaces.
 * Keeps the page hierarchy and action placement predictable across roles.
 */
export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  actions,
  titleId,
  className = '',
}: DashboardPageHeaderProps) {
  return (
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-800 dark:text-cyan-300">{eyebrow}</p>
        <h2 id={titleId} className="mt-1 text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

interface DashboardMetricCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  ariaLabel?: string;
  progress?: { value: number; label?: string };
  className?: string;
  iconClassName?: string;
}

/**
 * Shared accessible metric card. Interactive metrics use a native button;
 * informational metrics use an article so they remain semantically distinct.
 */
export function DashboardMetricCard({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
  ariaLabel,
  progress,
  className = '',
  iconClassName = 'text-cyan-700 dark:text-cyan-300',
}: DashboardMetricCardProps) {
  const content = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{label}</span>
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden="true" />}
      </span>
      <span className="mt-2 block text-2xl font-bold leading-none tracking-tight tabular-nums text-slate-950 dark:text-white">{value}</span>
      {progress && (
        <span
          className="mt-3 block h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          role="progressbar"
          aria-label={progress.label || label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, Math.max(0, progress.value))}
        >
          <span
            className="block h-full rounded-full bg-cyan-700 transition-[width] dark:bg-cyan-400"
            style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
          />
        </span>
      )}
      {detail !== undefined && <span className="mt-2 block text-xs leading-5 text-slate-600 dark:text-slate-400">{detail}</span>}
    </>
  );

  const sharedClassName = `sb-dashboard-metric min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900 ${className}`.trim();

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel || label}
        className={`${sharedClassName} group min-h-[112px] hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:border-cyan-800`}
      >
        {content}
      </button>
    );
  }

  return <article className={`${sharedClassName} min-h-[112px]`}>{content}</article>;
}
