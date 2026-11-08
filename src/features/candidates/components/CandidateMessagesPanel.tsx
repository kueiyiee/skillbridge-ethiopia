import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Briefcase, Check, Mail, Send } from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthContext';
import { api, type ApplicationMessage, type ApplicationMessageThread } from '@/src/services/api-client';

interface CandidateMessagesPanelProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

const dateTimeLabel = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleString();
};

const kindLabel: Record<ApplicationMessage['kind'], string> = {
  MESSAGE: 'Message',
  APPLICATION_UPDATE: 'Application update',
  SHORTLISTED: 'Shortlisting',
  INTERVIEW_INVITATION: 'Interview invitation',
  INFORMATION_REQUEST: 'Information request',
  ASSESSMENT_REQUEST: 'Assessment request',
};

export const CandidateMessagesPanel: React.FC<CandidateMessagesPanelProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<ApplicationMessageThread[]>([]);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<{ thread: ApplicationMessageThread; messages: ApplicationMessage[] } | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);

  const refreshThreads = useCallback(async () => {
    const result = await api.getCandidateMessageThreads();
    setThreads(result.threads);
    setUnreadCount(result.unreadCount);
    setSelectedApplicationId((current) => current || result.threads[0]?.applicationId || null);
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingThreads(true);
    api.getCandidateMessageThreads().then((result) => {
      if (!active) return;
      setThreads(result.threads);
      setUnreadCount(result.unreadCount);
      setSelectedApplicationId((current) => current || result.threads.find((thread) => thread.unreadCount > 0)?.applicationId || result.threads[0]?.applicationId || null);
    }).catch((loadFailure: unknown) => {
      if (active) {
        setUnreadCount(null);
        setError(loadFailure instanceof Error ? loadFailure.message : 'Messages could not be loaded.');
      }
    }).finally(() => {
      if (active) setLoadingThreads(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedApplicationId) {
      setConversation(null);
      return;
    }
    let active = true;
    setConversation(null);
    setLoadingConversation(true);
    setActionError(null);
    api.getCandidateConversation(selectedApplicationId).then((result) => {
      if (active) setConversation(result);
      void refreshThreads().catch((refreshFailure: unknown) => {
        if (active) {
          setUnreadCount(null);
          setActionError(refreshFailure instanceof Error ? refreshFailure.message : 'Unread messages could not be refreshed.');
        }
      });
    }).catch((loadFailure: unknown) => {
      if (active) setActionError(loadFailure instanceof Error ? loadFailure.message : 'This conversation could not be loaded.');
    }).finally(() => {
      if (active) setLoadingConversation(false);
    });
    return () => { active = false; };
  }, [selectedApplicationId, refreshThreads]);

  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedApplicationId || !reply.trim()) return;
    setSending(true);
    setActionError(null);
    try {
      await api.replyToEmployer(selectedApplicationId, reply.trim());
      setReply('');
      const [nextConversation] = await Promise.all([
        api.getCandidateConversation(selectedApplicationId),
        refreshThreads(),
      ]);
      setConversation(nextConversation);
    } catch (sendFailure) {
      setActionError(sendFailure instanceof Error ? sendFailure.message : 'Your reply could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const respondToInvitation = async (message: ApplicationMessage, response: 'ACCEPTED' | 'DECLINED') => {
    if (!selectedApplicationId) return;
    setSending(true);
    setActionError(null);
    try {
      await api.respondToInterviewInvitation(selectedApplicationId, message.id, response);
      const [nextConversation] = await Promise.all([
        api.getCandidateConversation(selectedApplicationId),
        refreshThreads(),
      ]);
      setConversation(nextConversation);
    } catch (responseFailure) {
      setActionError(responseFailure instanceof Error ? responseFailure.message : 'Your interview response could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const selectedThread = conversation?.thread || threads.find((thread) => thread.applicationId === selectedApplicationId);

  return (
    <section className="space-y-4" aria-labelledby="candidate-messages-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="candidate-messages-title" className="text-xl font-bold text-slate-950 dark:text-white">Messages &amp; Opportunities</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Employer messages, application updates, interviews, and next steps.</p>
        </div>
        <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200" aria-label={unreadCount === null ? 'Unread message count unavailable' : `${unreadCount} unread messages`}>
          <Mail className="h-4 w-4" aria-hidden="true" />{unreadCount === null ? 'Unavailable' : `${unreadCount} unread`}
        </span>
      </header>

      {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}</div>}
      <div className="grid min-h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className={`border-b border-slate-200 dark:border-slate-800 lg:border-b-0 lg:border-r ${mobileConversationOpen ? 'hidden lg:block' : ''}`} aria-label="Employer message inbox">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Inbox</h3>
            {loadingThreads && <span className="text-xs text-slate-500" role="status">Loading…</span>}
          </div>
          {!loadingThreads && threads.length === 0 && !error && (
            <div className="px-5 py-10 text-center">
              <Mail className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">No employer messages yet</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Messages and opportunities will appear here when an employer contacts you about an application.</p>
            </div>
          )}
          <ul className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {threads.map((thread) => (
              <li key={thread.applicationId}>
                <button
                  type="button"
                  onClick={() => { setSelectedApplicationId(thread.applicationId); setMobileConversationOpen(true); }}
                  aria-current={selectedApplicationId === thread.applicationId ? 'true' : undefined}
                  className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600 dark:hover:bg-slate-900 ${selectedApplicationId === thread.applicationId ? 'bg-slate-50 dark:bg-slate-900' : ''}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{thread.employerName}</span>
                    {thread.unreadCount > 0 && <span className="min-w-5 rounded-full bg-cyan-800 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{thread.unreadCount}</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-slate-600 dark:text-slate-300">{thread.jobTitle}</span>
                  <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{thread.lastMessage || 'Open conversation'}</span>
                  <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">{dateTimeLabel(thread.lastMessageAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className={`flex min-h-[420px] min-w-0 flex-col ${mobileConversationOpen ? '' : 'hidden lg:flex'}`}>
          {selectedThread ? (
            <>
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-2">
                  <button type="button" onClick={() => setMobileConversationOpen(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-600 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" aria-label="Back to message inbox">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">{selectedThread.employerName}</h3>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{selectedThread.jobTitle} · {selectedThread.applicationStatus.replaceAll('_', ' ').toLowerCase()}</p>
                  </div>
                </div>
                <button type="button" onClick={() => onNavigate('job-detail', { jobId: selectedThread.jobId })} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
                  <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />View job
                </button>
              </header>

              {actionError && <p role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}
              <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-label="Conversation messages">
                {loadingConversation && <p className="py-8 text-center text-sm text-slate-500" role="status">Loading conversation…</p>}
                {!loadingConversation && conversation?.messages.length === 0 && <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No messages in this conversation yet.</p>}
                {conversation?.messages.map((message) => {
                  const fromCandidate = message.senderUserId === user?.id;
                  const actionableInvite = !fromCandidate && message.kind === 'INTERVIEW_INVITATION' && message.actionStatus === 'PENDING';
                  return (
                    <article key={message.id} className={`max-w-[92%] rounded-xl border p-3 sm:max-w-[78%] ${fromCandidate ? 'ml-auto border-cyan-200 bg-cyan-50/80 dark:border-cyan-900 dark:bg-cyan-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{fromCandidate ? 'You' : message.senderName}</p>
                        <time className="text-[10px] text-slate-500 dark:text-slate-400" dateTime={message.createdAt}>{dateTimeLabel(message.createdAt)}</time>
                      </div>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">{kindLabel[message.kind]}</p>
                      {message.subject && <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{message.subject}</h4>}
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700 dark:text-slate-200">{message.body}</p>
                      {message.dueAt && (
                        <p className="mt-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200">
                          Interview: {dateTimeLabel(message.dueAt)}
                        </p>
                      )}
                      {message.kind === 'INTERVIEW_INVITATION' && message.actionStatus !== 'NONE' && message.actionStatus !== 'PENDING' && (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300"><Check className="h-3.5 w-3.5" aria-hidden="true" />Invitation {message.actionStatus.toLowerCase()}</p>
                      )}
                      {actionableInvite && <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void respondToInvitation(message, 'ACCEPTED')} disabled={sending} className="min-h-10 rounded-lg bg-cyan-800 px-3 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">Accept invitation</button>
                        <button type="button" onClick={() => void respondToInvitation(message, 'DECLINED')} disabled={sending} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Decline</button>
                      </div>}
                    </article>
                  );
                })}
              </div>

              <form onSubmit={(event) => void submitReply(event)} className="border-t border-slate-100 p-3 dark:border-slate-800 sm:p-4">
                <label htmlFor="candidate-message-reply" className="sr-only">Reply to employer</label>
                <div className="flex items-end gap-2">
                  <textarea id="candidate-message-reply" value={reply} onChange={(event) => setReply(event.target.value)} rows={2} maxLength={5000} placeholder="Write a reply…" className="min-h-11 min-w-0 flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                  <button type="submit" disabled={sending || !reply.trim()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
                    <Send className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{sending ? 'Sending…' : 'Reply'}</span>
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">Keep communication in SKILLBRIDGE ET. Your private contact details are not included in these messages.</p>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
              <Mail className="h-9 w-9 text-slate-400" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">{loadingThreads ? 'Loading your inbox…' : 'Select a conversation'}</p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 dark:text-slate-400">Employer messages and application-linked opportunities will be kept together here.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
