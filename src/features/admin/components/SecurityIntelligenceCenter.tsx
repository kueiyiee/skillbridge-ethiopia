import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Clock3, Database, Fingerprint, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '@/src/services/api-client';

export interface SecurityAuditEvent {
  id: string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
  actorName?: string | null;
  actorRole?: string | null;
}

interface SecurityIntelligenceCenterProps {
  events: SecurityAuditEvent[] | null;
  totalEvents: number | null;
  diagnosticsStatus?: string | null;
  databaseConnected?: boolean | null;
  loading: boolean;
  error?: string;
  onOpenAudit: () => void;
}

const SECURITY_ACTION = /(auth|login|logout|password|session|token|permission|role|access|mfa|passkey|credential|account|security|suspend|reactivat|verification)/i;

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
}

export const SecurityIntelligenceCenter: React.FC<SecurityIntelligenceCenterProps> = ({
  events,
  totalEvents,
  diagnosticsStatus,
  databaseConnected,
  loading,
  error,
  onOpenAudit,
}) => {
  const [mfaSummary, setMfaSummary] = useState<Array<{ role: string; totalAccounts: number; mfaEnabled: number }> | null>(null);

  useEffect(() => {
    let active = true;
    api.getAdminMfaAdoptionSummary().then((summary) => { if (active) setMfaSummary(summary); }).catch(() => { if (active) setMfaSummary(null); });
    return () => { active = false; };
  }, []);

  const mfaEnabled = mfaSummary?.reduce((sum, item) => sum + item.mfaEnabled, 0) ?? 0;
  const mfaTotal = mfaSummary?.reduce((sum, item) => sum + item.totalAccounts, 0) ?? 0;

  const securityEvents = useMemo(
    () => (events ?? []).filter((event) => SECURITY_ACTION.test(`${event.action} ${event.entityType ?? ''} ${event.details ?? ''}`)),
    [events],
  );

  const cards = [
    {
      label: 'Audit events in current page',
      value: events ? events.length.toLocaleString() : '—',
      detail: totalEvents === null ? 'Total unavailable' : `${totalEvents.toLocaleString()} total records`,
      icon: Activity,
    },
    {
      label: 'Security-related events',
      value: events ? securityEvents.length.toLocaleString() : '—',
      detail: 'Keyword-filtered from the loaded audit page',
      icon: ShieldAlert,
    },
    {
      label: 'Database connectivity',
      value: databaseConnected === null || databaseConnected === undefined ? 'Unknown' : databaseConnected ? 'Connected' : 'Unavailable',
      detail: 'Live application diagnostic',
      icon: Database,
    },
    {
      label: 'Application status',
      value: diagnosticsStatus ? diagnosticsStatus.replaceAll('-', ' ') : 'Unknown',
      detail: 'Live application diagnostic',
      icon: ShieldCheck,
    },
    {
      label: 'Accounts with MFA',
      value: mfaSummary ? `${mfaEnabled.toLocaleString()} / ${mfaTotal.toLocaleString()}` : '—',
      detail: mfaSummary ? 'Enabled TOTP across active accounts' : 'MFA adoption data unavailable',
      icon: KeyRound,
    },
  ];

  return (
    <section className="space-y-5" aria-labelledby="security-intelligence-title">
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1727] p-5 text-white shadow-xl shadow-slate-950/10 sm:p-7">
        <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-cyan-300/10" />
        <div className="pointer-events-none absolute -right-2 -top-10 h-44 w-44 rounded-full border border-cyan-300/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              <span className="h-2 w-2 rounded-full bg-cyan-300" /> Governance / Security
            </p>
            <h2 id="security-intelligence-title" className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">Security Intelligence Center</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Review persisted platform audit activity and current service diagnostics from one administrator-only workspace.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100">
            <ShieldCheck className="h-4 w-4" /> Admin workspace
          </div>
        </div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map(({ label, value, detail, icon: Icon }) => (
            <article key={label} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-300">{label}</p>
                <Icon className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden="true" />
              </div>
              <p className="mt-3 break-words text-2xl font-bold capitalize tracking-tight tabular-nums">{value}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{detail}</p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.75fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
            <div>
              <h3 className="text-sm font-bold text-slate-950 dark:text-white">Recent security-related audit events</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Filtered from the currently loaded audit page.</p>
            </div>
            <button type="button" onClick={onOpenAudit} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-cyan-500 hover:text-cyan-800 dark:border-slate-700 dark:text-slate-200 dark:hover:text-cyan-200">
              Full audit log <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          {error && <p className="m-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{error}</p>}
          {loading && !events && <p className="p-6 text-sm text-slate-500" role="status">Loading persisted audit events…</p>}
          {!loading && !error && events && securityEvents.length === 0 && (
            <div className="px-5 py-10 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">No matching security-related events on this page</p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500 dark:text-slate-400">This is not a guarantee that no threats exist. Review the full audit log and use dedicated detection controls for continuous monitoring.</p>
            </div>
          )}
          {securityEvents.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {securityEvents.slice(0, 10).map((event) => (
                <article key={event.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200"><Fingerprint className="h-4 w-4" aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <p className="break-words text-xs font-bold text-slate-900 dark:text-white">{event.action.replaceAll('_', ' ')}</p>
                      <p className="mt-1 break-words text-[11px] text-slate-500 dark:text-slate-400">
                        {event.actorName || 'System / unknown actor'}{event.actorRole ? ` · ${event.actorRole.replaceAll('_', ' ')}` : ''}{event.entityType ? ` · ${event.entityType}` : ''}
                      </p>
                      {event.details && <p className="mt-1.5 line-clamp-2 break-words text-[11px] leading-4 text-slate-600 dark:text-slate-300">{event.details}</p>}
                    </div>
                  </div>
                  <p className="inline-flex shrink-0 items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400"><Clock3 className="h-3 w-3" aria-hidden="true" />{formatDate(event.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">Connected data sources</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Live information displayed in this workspace is sourced from existing protected platform services.</p>
            <ul className="mt-4 space-y-3 text-xs">
              <li className="flex items-start justify-between gap-3">
                <span className="text-slate-700 dark:text-slate-300">Administrator audit API</span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${events ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>{loading ? 'Loading' : events ? 'Loaded' : 'Unavailable'}</span>
              </li>
              <li className="flex items-start justify-between gap-3">
                <span className="text-slate-700 dark:text-slate-300">System diagnostics API</span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${diagnosticsStatus ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>{diagnosticsStatus ? 'Responding' : 'Unavailable'}</span>
              </li>
              <li className="flex items-start justify-between gap-3">
                <span className="text-slate-700 dark:text-slate-300">Persisted event records</span>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${events ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'}`}>{events ? 'Loaded' : 'Unavailable'}</span>
              </li>
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">MFA adoption by role</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Counts are queried from active accounts and enabled authenticator factors.</p>
            {mfaSummary ? (
              <ul className="mt-4 space-y-3">
                {mfaSummary.map((item) => (
                  <li key={item.role} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.role.replaceAll('_', ' ')}</span>
                    <span className="font-mono font-bold tabular-nums text-slate-950 dark:text-white">{item.mfaEnabled.toLocaleString()} / {item.totalAccounts.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">MFA adoption data is unavailable.</p>}
          </section>
          <section className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-900/60 dark:bg-cyan-950/20 sm:p-5">
            <div className="flex items-center gap-2 text-cyan-900 dark:text-cyan-200"><ShieldAlert className="h-4 w-4" /><h3 className="text-xs font-bold">Monitoring scope</h3></div>
            <p className="mt-2 text-xs leading-5 text-cyan-950/80 dark:text-cyan-100/80">
              This first release visualizes existing audit records and service diagnostics. It is not a SIEM, intrusion-detection engine, vulnerability scanner, or proof of security certification.
            </p>
          </section>
        </aside>
      </div>
    </section>
  );
};
