import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Briefcase, Mail, Send, Users } from 'lucide-react';
import type { Application } from '@/shared/types';
import { api, type ApplicationMessage, type ApplicationMessageKind, type ApplicationMessageThread } from '@/src/services/api-client';

interface EmployerMessagesPanelProps {
  applications: Application[];
  isVerified: boolean;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  onReviewVerification: () => void;
  requestedApplicationId?: string | null;
  requestedApplicationIds?: string[];
}

type EmployerComposeKind = Exclude<ApplicationMessageKind, 'APPLICATION_UPDATE' | 'SHORTLISTED'>;
type MessageAudience = 'candidate' | 'selected' | 'job';

const messageKinds: Array<{ value: EmployerComposeKind; label: string }> = [
  { value: 'MESSAGE', label: 'Message' },
  { value: 'INTERVIEW_INVITATION', label: 'Interview invitation' },
  { value: 'INFORMATION_REQUEST', label: 'Request information' },
  { value: 'ASSESSMENT_REQUEST', label: 'Assessment request' },
];

const messageTemplates: Array<{
  label: string;
  kind: EmployerComposeKind;
  subject: string;
  body: string;
}> = [
  { label: 'Application received', kind: 'MESSAGE', subject: 'We received your application', body: 'Thank you for applying. We have received your application and will review it carefully. We will contact you if there are next steps.' },
  { label: 'Application under review', kind: 'MESSAGE', subject: 'Your application is under review', body: 'Thank you for applying. Our team is reviewing your application and will share an update when we have next steps.' },
  { label: 'Interview invitation', kind: 'INTERVIEW_INVITATION', subject: 'Interview invitation', body: 'We would like to invite you to interview for this role. Please review the date and time below and respond to the invitation.' },
  { label: 'Additional information', kind: 'INFORMATION_REQUEST', subject: 'Additional information requested', body: 'To continue reviewing your application, please provide the following information:\n\n' },
  { label: 'Assessment request', kind: 'ASSESSMENT_REQUEST', subject: 'Assessment next step', body: 'We would like you to complete the following assessment as part of the application process:\n\n' },
  { label: 'Recruitment delay', kind: 'MESSAGE', subject: 'Recruitment timeline update', body: 'We are writing to let you know that the recruitment timeline for this role has changed. We appreciate your patience and will share further updates when available.' },
  { label: 'General recruitment announcement', kind: 'MESSAGE', subject: 'Recruitment update', body: 'We have an update regarding your application for this role:\n\n' },
];

const dateTimeLabel = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleString();
};

const kindLabel: Record<ApplicationMessageKind, string> = {
  MESSAGE: 'Message',
  APPLICATION_UPDATE: 'Application update',
  SHORTLISTED: 'Shortlisting',
  INTERVIEW_INVITATION: 'Interview invitation',
  INFORMATION_REQUEST: 'Information request',
  ASSESSMENT_REQUEST: 'Assessment request',
};

export const EmployerMessagesPanel: React.FC<EmployerMessagesPanelProps> = ({
  applications,
  isVerified,
  onNavigate,
  onReviewVerification,
  requestedApplicationId,
  requestedApplicationIds = [],
}) => {
  const [threads, setThreads] = useState<ApplicationMessageThread[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<{ thread: ApplicationMessageThread; messages: ApplicationMessage[] } | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [composeKind, setComposeKind] = useState<EmployerComposeKind>('MESSAGE');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [sending, setSending] = useState(false);
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [audience, setAudience] = useState<MessageAudience>('candidate');
  const [singleRecipientId, setSingleRecipientId] = useState('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  const [jobRecipientId, setJobRecipientId] = useState('');
  const [bulkKind, setBulkKind] = useState<EmployerComposeKind>('MESSAGE');
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkBody, setBulkBody] = useState('');
  const [bulkDueAt, setBulkDueAt] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [bulkRequestId, setBulkRequestId] = useState<string | null>(null);

  const eligibleApplications = useMemo(
    () => applications.filter((application) => !['REJECTED', 'WITHDRAWN', 'HIRED'].includes(application.status)),
    [applications],
  );
  const jobOptions = useMemo(
    () => [...new Map(eligibleApplications.map((application) => [application.jobId, application.jobTitle])).entries()],
    [eligibleApplications],
  );
  const bulkRecipients = useMemo(() => {
    if (audience === 'candidate') return eligibleApplications.filter((application) => application.id === singleRecipientId);
    if (audience === 'selected') return eligibleApplications.filter((application) => selectedRecipientIds.includes(application.id));
    return eligibleApplications.filter((application) => application.jobId === jobRecipientId);
  }, [audience, eligibleApplications, jobRecipientId, selectedRecipientIds, singleRecipientId]);

  useEffect(() => {
    if (!confirmBulk) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = document.getElementById('confirm-bulk-title')?.closest<HTMLElement>('[role="dialog"]');
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])',
    ) ?? []);
    focusable()[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirmBulk(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmBulk]);

  const refreshThreads = useCallback(async () => {
    const result = await api.getEmployerMessageThreads();
    setThreads(result.threads);
    setUnreadCount(result.unreadCount);
  }, []);

  useEffect(() => {
    if (!isVerified) return;
    let active = true;
    setLoadingThreads(true);
    api.getEmployerMessageThreads().then((result) => {
      if (!active) return;
      setThreads(result.threads);
      setUnreadCount(result.unreadCount);
      setSelectedApplicationId((current) => current || result.threads[0]?.applicationId || applications[0]?.id || null);
    }).catch((failure: unknown) => {
      if (active) setThreadsError(failure instanceof Error ? failure.message : 'Messages could not be loaded.');
    }).finally(() => {
      if (active) setLoadingThreads(false);
    });
    return () => { active = false; };
  }, [isVerified, applications, refreshThreads]);

  useEffect(() => {
    if (!selectedApplicationId || !isVerified) {
      setConversation(null);
      return;
    }
    let active = true;
    setConversation(null);
    setLoadingConversation(true);
    setActionError(null);
    api.getEmployerConversation(selectedApplicationId).then((result) => {
      if (active) setConversation(result);
      void refreshThreads().catch((failure: unknown) => {
        if (active) setActionError(failure instanceof Error ? failure.message : 'Unread messages could not be refreshed.');
      });
    }).catch((failure: unknown) => {
      if (active) setActionError(failure instanceof Error ? failure.message : 'This conversation could not be loaded.');
    }).finally(() => {
      if (active) setLoadingConversation(false);
    });
    return () => { active = false; };
  }, [selectedApplicationId, isVerified, refreshThreads]);

  useEffect(() => {
    if (requestedApplicationId && applications.some((application) => application.id === requestedApplicationId)) {
      setSelectedApplicationId(requestedApplicationId);
      setSingleRecipientId(requestedApplicationId);
      setAudience('candidate');
    }
  }, [applications, requestedApplicationId]);

  useEffect(() => {
    if (requestedApplicationIds.length === 0) return;
    const validIds = requestedApplicationIds.filter((id) => eligibleApplications.some((application) => application.id === id));
    setSelectedRecipientIds(validIds);
    setAudience('selected');
    setBulkRequestId(null);
  }, [eligibleApplications, requestedApplicationIds.join(',')]);

  useEffect(() => {
    if (selectedApplicationId && !applications.some((application) => application.id === selectedApplicationId)) {
      setSelectedApplicationId(applications[0]?.id || null);
    } else if (!selectedApplicationId && applications.length > 0 && !loadingThreads) {
      setSelectedApplicationId(applications[0].id);
    }
  }, [applications, selectedApplicationId, loadingThreads]);

  const selectedApplication = applications.find((application) => application.id === selectedApplicationId);
  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedApplicationId || !body.trim()) return;
    if (composeKind === 'INTERVIEW_INVITATION' && !dueAt) {
      setActionError('Choose an interview date and time before sending the invitation.');
      return;
    }
    setSending(true);
    setActionError(null);
    try {
      await api.sendEmployerMessage(selectedApplicationId, {
        kind: composeKind,
        body: body.trim(),
        ...(subject.trim() ? { subject: subject.trim() } : {}),
        ...(composeKind === 'INTERVIEW_INVITATION' && dueAt ? { dueAt: new Date(dueAt).toISOString() } : {}),
      });
      setSubject('');
      setBody('');
      setDueAt('');
      const [nextConversation] = await Promise.all([
        api.getEmployerConversation(selectedApplicationId),
        refreshThreads(),
      ]);
      setConversation(nextConversation);
    } catch (failure) {
      setActionError(failure instanceof Error ? failure.message : 'The message could not be sent.');
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (templateLabel: string) => {
    const template = messageTemplates.find((item) => item.label === templateLabel);
    if (!template) return;
    setBulkKind(template.kind);
    setBulkSubject(template.subject);
    setBulkBody(template.body);
    setBulkDueAt('');
    setBulkRequestId(null);
    setBulkError(null);
    setBulkSuccess(null);
  };

  const sendBulkMessage = async () => {
    if (!bulkRecipients.length || !bulkBody.trim()) return;
    if (bulkKind === 'INTERVIEW_INVITATION' && !bulkDueAt) {
      setBulkError('Choose an interview date and time before sending the invitations.');
      return;
    }
    setBulkSending(true);
    setBulkError(null);
    setBulkSuccess(null);
    const requestId = bulkRequestId ?? globalThis.crypto.randomUUID();
    setBulkRequestId(requestId);
    try {
      const result = await api.sendEmployerBulkMessage({
        requestId,
        applicationIds: bulkRecipients.map((application) => application.id),
        kind: bulkKind,
        subject: bulkSubject.trim() || undefined,
        body: bulkBody.trim(),
        ...(bulkKind === 'INTERVIEW_INVITATION' && bulkDueAt ? { dueAt: new Date(bulkDueAt).toISOString() } : {}),
      });
      setBulkSuccess(`${result.duplicate ? 'This update was already delivered' : 'Update sent'} to ${result.recipientCount} candidate${result.recipientCount === 1 ? '' : 's'}.`);
      setBulkRequestId(null);
      setBulkSubject('');
      setBulkBody('');
      setBulkDueAt('');
      setConfirmBulk(false);
      await refreshThreads();
    } catch (failure) {
      setBulkError(failure instanceof Error ? failure.message : 'The candidate update could not be sent.');
    } finally {
      setBulkSending(false);
    }
  };

  if (!isVerified) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold text-slate-950 dark:text-white">Messages &amp; Notifications</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Employer messaging is available after business verification, and only for candidates who applied to your organization’s vacancies.</p>
        <button type="button" onClick={onReviewVerification} className="mt-4 min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">Review business verification</button>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="employer-messages-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="employer-messages-title" className="text-xl font-bold text-slate-950 dark:text-white">Messages &amp; Notifications</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Contact applicants through their job application. Status changes also appear as candidate notifications.</p>
        </div>
        <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <Mail className="h-4 w-4" aria-hidden="true" />{unreadCount} unread
        </span>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:p-5" aria-labelledby="candidate-update-title">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200"><Users className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <h3 id="candidate-update-title" className="font-semibold text-slate-950 dark:text-white">Send a candidate update</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">Each recipient receives a separate private message linked to their application. Status changes such as shortlist or rejection must be made in Applications.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Audience
            <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={audience} onChange={(event) => {
              setAudience(event.target.value as MessageAudience);
              setBulkRequestId(null);
              setBulkError(null);
              setBulkSuccess(null);
            }}>
              <option value="candidate">One candidate</option>
              <option value="selected">Selected candidates</option>
              <option value="job">Applicants for one job</option>
            </select>
          </label>
          {audience === 'candidate' && <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Candidate and application
            <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={singleRecipientId} onChange={(event) => {
              setSingleRecipientId(event.target.value);
              setBulkRequestId(null);
            }}>
              <option value="">Choose an applicant</option>
              {eligibleApplications.map((application) => <option key={application.id} value={application.id}>{application.candidateName} · {application.jobTitle}</option>)}
            </select>
          </label>}
          {audience === 'job' && <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Job
            <select className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" value={jobRecipientId} onChange={(event) => {
              setJobRecipientId(event.target.value);
              setBulkRequestId(null);
            }}>
              <option value="">Choose a job</option>
              {jobOptions.map(([jobId, jobTitle]) => <option key={jobId} value={jobId}>{jobTitle}</option>)}
            </select>
          </label>}
        </div>

        {audience === 'selected' && <fieldset className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">Select applicants ({selectedRecipientIds.filter((id) => eligibleApplications.some((application) => application.id === id)).length} selected)</legend>
          <div className="max-h-44 space-y-1 overflow-y-auto">
            {eligibleApplications.map((application) => <label key={application.id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900">
              <input type="checkbox" checked={selectedRecipientIds.includes(application.id)} onChange={(event) => {
                setSelectedRecipientIds((current) => event.target.checked
                  ? [...current, application.id]
                  : current.filter((id) => id !== application.id));
                setBulkRequestId(null);
              }} className="h-4 w-4 rounded border-slate-300 text-cyan-800 focus:ring-cyan-700" />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200">{application.candidateName} · {application.jobTitle}</span>
              <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{application.status.replaceAll('_', ' ').toLowerCase()}</span>
            </label>)}
            {eligibleApplications.length === 0 && <p className="py-3 text-sm text-slate-500">There are no active applicant records to message.</p>}
          </div>
        </fieldset>}

        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/70">
          <p className="font-semibold text-slate-800 dark:text-slate-200">Audience: {audience === 'candidate' ? 'One candidate' : audience === 'selected' ? 'Selected candidates' : 'Applicants for one job'}</p>
          <p className="mt-0.5 text-slate-600 dark:text-slate-400">Job: {audience === 'candidate' ? bulkRecipients[0]?.jobTitle || 'Choose a candidate' : audience === 'job' ? jobOptions.find(([id]) => id === jobRecipientId)?.[1] || 'Choose a job' : 'Selected applications'}</p>
          <p className="mt-0.5 text-slate-600 dark:text-slate-400">Recipients: {bulkRecipients.length}</p>
          {bulkRecipients.length > 0 && <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-cyan-900 dark:text-cyan-200">Review recipient list</summary>
            <ul className="mt-2 max-h-28 list-inside list-disc space-y-1 overflow-y-auto text-xs text-slate-600 dark:text-slate-400">
              {bulkRecipients.map((application) => <li key={application.id}>{application.candidateName} · {application.jobTitle}</li>)}
            </ul>
          </details>}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Template
            <select defaultValue="" onChange={(event) => applyTemplate(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              <option value="">Start from a blank message</option>
              {messageTemplates.map((template) => <option key={template.label} value={template.label}>{template.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Message type
            <select value={bulkKind} onChange={(event) => { setBulkKind(event.target.value as EmployerComposeKind); setBulkRequestId(null); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
              {messageKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">Subject
            <input maxLength={191} value={bulkSubject} onChange={(event) => { setBulkSubject(event.target.value); setBulkRequestId(null); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="Optional subject" />
          </label>
          {bulkKind === 'INTERVIEW_INVITATION' && <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">Interview date and time
            <input required type="datetime-local" value={bulkDueAt} onChange={(event) => { setBulkDueAt(event.target.value); setBulkRequestId(null); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
          </label>}
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">Message
            <textarea required minLength={1} maxLength={5000} rows={4} value={bulkBody} onChange={(event) => { setBulkBody(event.target.value); setBulkRequestId(null); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" placeholder="Write a relevant, professional update." />
          </label>
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Organization-wide announcements are disabled: no explicit candidate opt-in field exists. Only applicants to your verified organization’s jobs can be contacted here. Group messages are delivered privately, one application at a time.</p>
        {bulkError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{bulkError}</p>}
        {bulkSuccess && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{bulkSuccess}</p>}
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={bulkSending || bulkRecipients.length === 0 || !bulkBody.trim()} onClick={() => setConfirmBulk(true)} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"><Send className="h-4 w-4" aria-hidden="true" />Review and send</button>
        </div>
      </section>

      {confirmBulk && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmBulk(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="confirm-bulk-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
          <h3 id="confirm-bulk-title" className="text-lg font-bold text-slate-950 dark:text-white">Confirm candidate update</h3>
          <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">
            <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Audience</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-200">{audience === 'candidate' ? 'One candidate' : audience === 'selected' ? 'Selected candidates' : 'Applicants for one job'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Job</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-200">{audience === 'candidate' ? bulkRecipients[0]?.jobTitle || '—' : audience === 'job' ? jobOptions.find(([id]) => id === jobRecipientId)?.[1] || '—' : 'Selected applications'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Recipients</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-200">{bulkRecipients.length}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Message type</dt><dd className="text-right font-semibold text-slate-800 dark:text-slate-200">{messageKinds.find((kind) => kind.value === bulkKind)?.label}</dd></div>
          </dl>
          <ul className="mt-3 max-h-36 list-inside list-disc space-y-1 overflow-y-auto text-sm text-slate-700 dark:text-slate-300">
            {bulkRecipients.map((application) => <li key={application.id}>{application.candidateName} · {application.jobTitle}</li>)}
          </ul>
          <p className="mt-3 whitespace-pre-wrap rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">{bulkBody}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" disabled={bulkSending} onClick={() => setConfirmBulk(false)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Back</button>
            <button type="button" disabled={bulkSending || !bulkRecipients.length} onClick={() => void sendBulkMessage()} className="min-h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">{bulkSending ? 'Sending…' : 'Confirm send'}</button>
          </div>
        </section>
      </div>}

      {threadsError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{threadsError}<button type="button" onClick={() => { setThreadsError(null); setLoadingThreads(true); void refreshThreads().catch((failure: unknown) => setThreadsError(failure instanceof Error ? failure.message : 'Messages could not be loaded.')).finally(() => setLoadingThreads(false)); }} className="ml-2 font-semibold underline">Retry</button></div>}
      <div className="grid min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className={`border-b border-slate-200 dark:border-slate-800 lg:border-b-0 lg:border-r ${mobileConversationOpen ? 'hidden lg:block' : ''}`} aria-label="Applicant conversations">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Applicants</h3>
            {loadingThreads && <span className="text-xs text-slate-500" role="status">Loading…</span>}
          </div>
          {applications.length === 0 && !loadingThreads && <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Applications will appear here when candidates apply.</p>}
          <ul className="max-h-[640px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {applications.map((application) => {
              const thread = threads.find((item) => item.applicationId === application.id);
              return (
                <li key={application.id}>
                  <button type="button" onClick={() => { setSelectedApplicationId(application.id); setMobileConversationOpen(true); }} aria-current={selectedApplicationId === application.id ? 'true' : undefined} className={`w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600 dark:hover:bg-slate-900 ${selectedApplicationId === application.id ? 'bg-slate-50 dark:bg-slate-900' : ''}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{application.candidateName}</span>
                      {thread?.unreadCount ? <span className="min-w-5 rounded-full bg-cyan-800 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">{thread.unreadCount}</span> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-slate-300">{application.jobTitle}</span>
                    <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{thread?.lastMessage || application.status.replaceAll('_', ' ').toLowerCase()}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className={`flex min-h-[520px] min-w-0 flex-col ${mobileConversationOpen ? '' : 'hidden lg:flex'}`}>
          {selectedApplication ? (
            <>
              <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <div className="flex min-w-0 items-center gap-2">
                  <button type="button" onClick={() => setMobileConversationOpen(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-600 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" aria-label="Back to applicants">
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-950 dark:text-white">{selectedApplication.candidateName}</h3>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{selectedApplication.jobTitle} · {selectedApplication.status.replaceAll('_', ' ').toLowerCase()}</p>
                  </div>
                </div>
                <button type="button" onClick={() => onNavigate('job-detail', { jobId: selectedApplication.jobId })} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" />View job</button>
              </header>

              {actionError && <p role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}
              <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite" aria-label="Conversation messages">
                {loadingConversation && <p className="py-8 text-center text-sm text-slate-500" role="status">Loading conversation…</p>}
                {!loadingConversation && conversation?.messages.length === 0 && <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Start a conversation with this applicant. Messages remain linked to this application.</p>}
                {conversation?.messages.map((message) => {
                  const fromEmployer = message.senderUserId === conversation.thread.employerUserId;
                  return (
                    <article key={message.id} className={`max-w-[92%] rounded-xl border p-3 sm:max-w-[78%] ${fromEmployer ? 'ml-auto border-cyan-200 bg-cyan-50/80 dark:border-cyan-900 dark:bg-cyan-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{fromEmployer ? 'Your organization' : message.senderName}</p>
                        <time className="text-[10px] text-slate-500 dark:text-slate-400" dateTime={message.createdAt}>{dateTimeLabel(message.createdAt)}</time>
                      </div>
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">{kindLabel[message.kind]}</p>
                      {message.subject && <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{message.subject}</h4>}
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700 dark:text-slate-200">{message.body}</p>
                      {message.dueAt && <p className="mt-2 rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-200">Interview: {dateTimeLabel(message.dueAt)}</p>}
                      {message.kind === 'INTERVIEW_INVITATION' && message.actionStatus !== 'NONE' && message.actionStatus !== 'PENDING' && <p className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Candidate {message.actionStatus.toLowerCase()} the invitation.</p>}
                    </article>
                  );
                })}
              </div>

              <form onSubmit={(event) => void sendMessage(event)} className="space-y-3 border-t border-slate-100 p-3 dark:border-slate-800 sm:p-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Message type
                    <select value={composeKind} onChange={(event) => setComposeKind(event.target.value as EmployerComposeKind)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                      {messageKinds.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                    </select>
                  </label>
                  {composeKind === 'INTERVIEW_INVITATION' ? (
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Interview date and time
                      <input required type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                    </label>
                  ) : (
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Subject (optional)
                      <input maxLength={191} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                    </label>
                  )}
                </div>
                {composeKind === 'INTERVIEW_INVITATION' && <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Subject (optional)
                  <input maxLength={191} value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                </label>}
                <label htmlFor="employer-message-body" className="sr-only">Message content</label>
                <div className="flex items-end gap-2">
                  <textarea id="employer-message-body" required minLength={1} maxLength={5000} rows={2} value={body} onChange={(event) => setBody(event.target.value)} placeholder={composeKind === 'INTERVIEW_INVITATION' ? 'Include interview format, location or meeting details, and any preparation…' : 'Write a message…'} className="min-h-11 min-w-0 flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                  <button type="submit" disabled={sending || !body.trim()} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"><Send className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span></button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Only verified employers can message candidates who applied to their jobs. Candidate contact details are not disclosed by messaging.</p>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 py-12 text-center">
              <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{loadingThreads ? 'Loading applicant conversations…' : 'Select an applicant to view or start an application-linked conversation.'}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
