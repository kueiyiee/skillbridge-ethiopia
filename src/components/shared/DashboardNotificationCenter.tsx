import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Briefcase, ChevronRight, Clock, ShieldCheck } from 'lucide-react';
import { api, type ApplicationMessageThread } from '@/src/services/api-client';

type NotificationRole = 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';

interface DashboardNotificationCenterProps {
  role: NotificationRole;
  onOpen: () => void;
  enabled?: boolean;
}

function relativeTime(value: string | null) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

export const DashboardNotificationCenter: React.FC<DashboardNotificationCenterProps> = ({
  role,
  onOpen,
  enabled = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [threads, setThreads] = useState<ApplicationMessageThread[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(role === 'ADMIN' ? 0 : null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (role === 'ADMIN' || !enabled) return;
    const result = role === 'JOB_SEEKER'
      ? await api.getCandidateMessageThreads()
      : await api.getEmployerMessageThreads();
    setThreads(result.threads);
    setUnreadCount(result.unreadCount);
    setError(null);
  }, [enabled, role]);

  useEffect(() => {
    if (role === 'ADMIN' || !enabled) return;
    let active = true;
    const load = async () => {
      if (document.visibilityState === 'hidden') return;
      setLoading(true);
      try {
        await refresh();
      } catch (failure) {
        if (active) setError(failure instanceof Error ? failure.message : 'Notifications could not be refreshed.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 20000);
    const onVisibility = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, refresh, role]);

  const recentNotifications = useMemo(
    () => threads.filter((thread) => thread.lastMessageAt).slice(0, 6),
    [threads],
  );

  const heading = role === 'JOB_SEEKER' ? 'Employer activity' : role === 'EMPLOYER' ? 'Candidate activity' : 'Governance activity';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={role === 'ADMIN' ? 'Open governance information' : `Open notifications, ${unreadCount ?? 'unknown'} unread`}
        className="relative inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-800 dark:hover:bg-cyan-950/30"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Notifications</span>
        {role !== 'ADMIN' && unreadCount !== null && unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          role="dialog"
          aria-label="Notification center"
          className="absolute right-0 z-40 mt-2 w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-white">Notification center</h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{heading}</p>
            </div>
            {role !== 'ADMIN' && <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200">{unreadCount === null ? '— unread' : `${unreadCount} unread`}</span>}
          </header>

          {role === 'ADMIN' ? (
            <div className="p-4">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200"><ShieldCheck className="h-5 w-5" /></span>
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Privacy-preserving oversight</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">Private candidate–employer conversations are restricted to their participants. Review platform actions and governance events in the audit log instead.</p>
                </div>
              </div>
              <button type="button" onClick={() => { setIsOpen(false); onOpen(); }} className="mt-4 flex min-h-10 w-full items-center justify-between rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
                Open audit activity <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {error && <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
              {loading && recentNotifications.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500" role="status">Checking for new activity…</p>
              ) : recentNotifications.length === 0 ? (
                <div className="p-7 text-center">
                  <Bell className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">You’re all caught up</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">New application messages and interview updates will appear here.</p>
                </div>
              ) : (
                <ul className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                  {recentNotifications.map((thread) => {
                    const unread = thread.unreadCount > 0;
                    const otherParty = role === 'JOB_SEEKER' ? thread.employerName : thread.candidateName;
                    return (
                      <li key={thread.applicationId}>
                        <button type="button" onClick={() => { setIsOpen(false); onOpen(); }} className="flex min-h-[76px] w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500 dark:hover:bg-slate-900">
                          <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${unread ? 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}>
                            <Briefcase className="h-4 w-4" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-bold text-slate-900 dark:text-white">{otherParty}</span>
                              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] text-slate-500"><Clock className="h-3 w-3" />{relativeTime(thread.lastMessageAt)}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">{thread.jobTitle}</span>
                            <span className="mt-1 block truncate text-xs text-slate-700 dark:text-slate-300">{thread.lastMessage || 'Application activity updated'}</span>
                          </span>
                          {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-cyan-600" aria-label="Unread" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <footer className="border-t border-slate-100 p-3 dark:border-slate-800">
                <button type="button" onClick={() => { setIsOpen(false); onOpen(); }} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
                  Open messages <ChevronRight className="h-4 w-4" />
                </button>
                <p className="mt-2 text-center text-[10px] text-slate-500 dark:text-slate-400">Refreshes automatically while this dashboard is open.</p>
              </footer>
            </>
          )}
        </section>
      )}
    </div>
  );
};
