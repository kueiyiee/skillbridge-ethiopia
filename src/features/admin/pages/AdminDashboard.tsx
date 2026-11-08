import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/src/app/providers/AuthContext';
import type { SystemStatus } from '@/shared/types';
import { api, type AdminEmployerVerificationSummary, type AdminPageResult, type AdminReport, type AdminReportFormat, type AdminReportType, type AdminUserSummary, type EmployerVerificationDocument, type EmployerVerificationHistoryItem } from '@/src/services/api-client';
import { BrandLogo } from '@/src/components/shared/BrandLogo';
import { DashboardMetricCard, DashboardPageHeader } from '@/src/components/shared/DashboardPrimitives';
import { ThemeSwitcher } from '@/src/components/navigation/ThemeSwitcher';
import { AdminManagement } from '../components/AdminManagement';
import { 
  Users, 
  Building2, 
  Briefcase,
  Activity, 
  FileText, 
  RefreshCw,
  Home,
  LogOut,
  Lock,
  Search,
  ChevronRight,
  User,
  Settings,
  ShieldCheck,
  Menu,
  X,
  Bot,
  ArrowLeft,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Mail,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

const MIN_SIDEBAR_WIDTH = 208;
const MIN_MAIN_CONTENT_WIDTH = 320;

const adminNavGroups = [
  {
    label: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', emoji: '📊', title: 'Overview', description: 'A concise view of platform activity, governance, and service health.' },
      { id: 'verifications', label: 'Employer Verification', emoji: '🏢', title: 'Employer Verification', description: 'Review submitted business details and record internal verification decisions.' },
      { id: 'users', label: 'User Management', emoji: '👥', title: 'User Management', description: 'Find accounts, review access status, and take authorized moderation actions.' },
      { id: 'jobs', label: 'Jobs & Moderation', emoji: '💼', title: 'Jobs & Moderation', description: 'Review current job publishing statuses and platform job activity.' },
      { id: 'management', label: 'Data Management', emoji: '🗂️', title: 'Data Management', description: 'Create, edit, archive, and restore users, employers, jobs, and applications.' },
    ],
  },
  {
    label: 'Insights & services',
    items: [
      { id: 'audit', label: 'Audit Logs', emoji: '📜', title: 'Audit Logs', description: 'Search the read-only record of administrative and platform events.' },
      { id: 'diagnostics', label: 'System Health', emoji: '🖥️', title: 'System Health', description: 'Check application, database, migration, and integration status.' },
      { id: 'ai', label: 'AI & Integrations', emoji: '🤖', title: 'AI & Integrations', description: 'Review configured AI providers and their recorded service status.' },
      { id: 'reports', label: 'Reports & Analytics', emoji: '📈', title: 'Reports & Analytics', description: 'Review current operational totals reported by the platform.' },
    ],
  },
  {
    label: 'Preferences',
    items: [
      { id: 'settings', label: 'Settings', emoji: '⚙️', title: 'Settings', description: 'Manage your administrator profile, privacy preferences, and account security.' },
    ],
  },
] as const;

const adminSections = adminNavGroups.reduce<Array<(typeof adminNavGroups)[number]['items'][number]>>((sections, group) => {
  sections.push(...group.items);
  return sections;
}, []);

type AdminSection = typeof adminSections[number]['id'];

function VerificationDocumentReviewCard({
  document,
  busy,
  onReview,
  onPreview,
  onDownload,
}: {
  document: EmployerVerificationDocument;
  busy: boolean;
  onReview: (document: EmployerVerificationDocument, status: EmployerVerificationDocument['status'], notes: string) => Promise<void>;
  onPreview: (document: EmployerVerificationDocument) => void;
  onDownload: (document: EmployerVerificationDocument) => void;
}) {
  const [status, setStatus] = useState<EmployerVerificationDocument['status']>('APPROVED');
  const [notes, setNotes] = useState('');
  const finalized = document.status === 'APPROVED' || document.status === 'REJECTED';
  return (
    <article className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-all text-sm font-semibold text-slate-900 dark:text-white">{document.originalFilename}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{document.category.replaceAll('_', ' ')} · {(document.sizeBytes / 1024).toFixed(0)} KB · Submitted {new Date(document.submittedAt).toLocaleString()}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Status: {document.status.replaceAll('_', ' ')}{document.reviewerName ? ` · Reviewed by ${document.reviewerName}` : ''}{document.reviewedAt ? ` · ${new Date(document.reviewedAt).toLocaleString()}` : ''}</p>
          {document.reviewNotes && <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">Reviewer feedback: {document.reviewNotes}</p>}
        </div>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => onPreview(document)} className="min-h-8 rounded-md border border-slate-300 px-2.5 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">Preview</button>
          <button type="button" disabled={busy} onClick={() => onDownload(document)} className="min-h-8 rounded-md border border-slate-300 px-2.5 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">Download</button>
        </div>
      </div>
      {!finalized && <form onSubmit={(event) => { event.preventDefault(); void onReview(document, status, notes); }} className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-end">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Document decision
          <select value={status} onChange={(event) => setStatus(event.target.value as EmployerVerificationDocument['status'])} className="mt-1 min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950">
            <option value="APPROVED">Approve document</option>
            <option value="REJECTED">Reject document</option>
            <option value="RESUBMISSION_REQUIRED">Request replacement</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Review note
          <input required minLength={3} maxLength={1000} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <button type="submit" disabled={busy || notes.trim().length < 3} className="min-h-9 rounded-md bg-[#10243c] px-3 text-xs font-semibold text-white disabled:opacity-50 dark:bg-cyan-800">{busy ? 'Saving…' : 'Record review'}</button>
      </form>}
    </article>
  );
}

const adminReportDefinitions: Record<AdminReportType, {
  label: string;
  category: string;
  description: string;
  fields: Array<{ key: string; label: string }>;
}> = {
  'platform-overview': {
    label: 'Platform Summary',
    category: 'Platform overview',
    description: 'Current platform totals and activity counts for the selected reporting period.',
    fields: [{ key: 'activity', label: 'Activity' }, { key: 'count', label: 'Records' }],
  },
  'employer-verification': {
    label: 'Employer Verification',
    category: 'Users and employers',
    description: 'Verification submissions, organization details, decisions, and reviewer notes.',
    fields: [
      { key: 'companyName', label: 'Organization' }, { key: 'industry', label: 'Industry' },
      { key: 'city', label: 'City' }, { key: 'contactEmail', label: 'Contact email' },
      { key: 'status', label: 'Status' }, { key: 'createdAt', label: 'Submitted at' },
      { key: 'reviewedAt', label: 'Decision at' }, { key: 'reviewerName', label: 'Reviewed by' },
      { key: 'reviewNotes', label: 'Decision reason' },
    ],
  },
  'user-management': {
    label: 'User Management',
    category: 'Users and employers',
    description: 'Account names, email, role, account status, and registration date.',
    fields: [
      { key: 'fullName', label: 'Name' }, { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' }, { key: 'status', label: 'Account status' },
      { key: 'createdAt', label: 'Registered at' },
    ],
  },
  'jobs-moderation': {
    label: 'Job Listings and Moderation',
    category: 'Recruitment',
    description: 'Job listings, employer approval, effective posting status, deadlines, and applicant totals.',
    fields: [
      { key: 'title', label: 'Job title' }, { key: 'companyName', label: 'Employer' },
      { key: 'jobType', label: 'Job type' }, { key: 'storedStatus', label: 'Stored status' },
      { key: 'effectiveStatus', label: 'Effective status' }, { key: 'employerStatus', label: 'Employer approval' },
      { key: 'deadline', label: 'Deadline' }, { key: 'createdAt', label: 'Posted at' },
      { key: 'applicantsCount', label: 'Applicants' },
    ],
  },
  applications: {
    label: 'Applications and Recruitment Pipeline',
    category: 'Recruitment',
    description: 'Application stage and job information; candidate identity and profile data are excluded.',
    fields: [
      { key: 'jobTitle', label: 'Job title' }, { key: 'companyName', label: 'Employer' },
      { key: 'jobType', label: 'Job type' }, { key: 'city', label: 'City' },
      { key: 'status', label: 'Application status' }, { key: 'appliedAt', label: 'Applied at' },
      { key: 'matchScore', label: 'Match score (%)' },
    ],
  },
  'audit-activity': {
    label: 'Administrative Audit Logs',
    category: 'Governance and operations',
    description: 'Administrative event metadata without free-form details, credentials, or session identifiers.',
    fields: [
      { key: 'createdAt', label: 'Timestamp' }, { key: 'actorName', label: 'Actor' },
      { key: 'actorRole', label: 'Actor role' }, { key: 'action', label: 'Event type' },
      { key: 'entityType', label: 'Target type' }, { key: 'entityId', label: 'Target ID' },
      { key: 'outcome', label: 'Outcome' },
    ],
  },
  'system-health': {
    label: 'System Health',
    category: 'Governance and operations',
    description: 'A point-in-time health and migration status summary; sensitive infrastructure details are omitted.',
    fields: [
      { key: 'component', label: 'Component' }, { key: 'status', label: 'Status' },
      { key: 'detail', label: 'Details' },
    ],
  },
  'ai-integration-usage': {
    label: 'AI Nexus and Integration Usage',
    category: 'Governance and operations',
    description: 'In-memory provider status and usage counters since the backend started.',
    fields: [
      { key: 'provider', label: 'Provider' }, { key: 'configured', label: 'Configured' },
      { key: 'availability', label: 'Availability' }, { key: 'model', label: 'Model' },
      { key: 'requests', label: 'Requests' }, { key: 'fallbacks', label: 'Fallbacks' },
      { key: 'failures', label: 'Failures' }, { key: 'averageLatencyMs', label: 'Average latency (ms)' },
    ],
  },
};

type ReportDatePreset = 'all' | 'today' | 'last-7-days' | 'last-30-days' | 'this-month' | 'previous-month' | 'this-year' | 'custom';

function formatReportDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getReportDateRange(preset: Exclude<ReportDatePreset, 'custom'>): { startDate: string; endDate: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(start);
  if (preset === 'today') return { startDate: formatReportDate(start), endDate: formatReportDate(end) };
  if (preset === 'last-7-days') start.setDate(start.getDate() - 6);
  if (preset === 'last-30-days') start.setDate(start.getDate() - 29);
  if (preset === 'this-month') start.setDate(1);
  if (preset === 'previous-month') {
    start.setMonth(start.getMonth() - 1, 1);
    end.setDate(0);
  }
  if (preset === 'this-year') {
    start.setMonth(0, 1);
  }
  return { startDate: formatReportDate(start), endDate: formatReportDate(end) };
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { user: currentUser, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get('section');
  const normalizedSection = requestedSection === 'email-verification' ? 'verifications' : requestedSection;
  useEffect(() => {
    if (requestedSection === 'email-verification') {
      setSearchParams({ section: 'verifications' }, { replace: true });
    }
  }, [requestedSection, setSearchParams]);
  const activeTab: AdminSection = adminSections.some((section) => section.id === normalizedSection)
    ? normalizedSection as AdminSection
    : 'overview';
  const activeSection = adminSections.find((section) => section.id === activeTab)!;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('skillbridge_admin_sidebar_collapsed') === 'true');
  const [sidebarSide, setSidebarSide] = useState<'left' | 'right'>(() => localStorage.getItem('skillbridge_admin_sidebar_side') === 'right' ? 'right' : 'left');
  const [sidebarDragging, setSidebarDragging] = useState(false);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const storedWidth = localStorage.getItem('skillbridge_admin_sidebar_width');
    if (storedWidth === null) return 256;
    const savedWidth = Number(storedWidth);
    return Number.isFinite(savedWidth) ? Math.max(MIN_SIDEBAR_WIDTH, savedWidth) : 256;
  });
  const [sidebarResizeMode, setSidebarResizeMode] = useState(false);
  const sidebarLayoutRef = useRef<HTMLDivElement>(null);
  const sidebarResizeDragRef = useRef<{ pointerId: number; startX: number; startWidth: number; direction: 1 | -1 } | null>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);
  const [verifications, setVerifications] = useState<AdminPageResult<any> | null>(null);
  const [users, setUsers] = useState<(AdminPageResult<any> & { summary?: AdminUserSummary }) | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminPageResult<any> | null>(null);
  const [adminJobs, setAdminJobs] = useState<AdminPageResult<any> | null>(null);
  const [userSearchDraft, setUserSearchDraft] = useState('');
  const [userFilters, setUserFilters] = useState({
    search: '',
    role: '',
    status: '',
    emailStatus: '' as '' | 'verified' | 'unverified' | 'action_required',
    page: 1,
  });
  const [verificationSearchDraft, setVerificationSearchDraft] = useState('');
  const [verificationFilters, setVerificationFilters] = useState({
    search: '',
    status: '',
    emailStatus: '' as '' | 'verified' | 'unverified' | 'action_required',
    sort: 'createdAt' as 'createdAt' | 'companyName' | 'email' | 'status',
    direction: 'desc' as 'asc' | 'desc',
    page: 1,
  });
  const [jobSearchDraft, setJobSearchDraft] = useState('');
  const [jobFilters, setJobFilters] = useState({ search: '', status: '', page: 1 });
  const [auditSearchDraft, setAuditSearchDraft] = useState('');
  const [auditActionDraft, setAuditActionDraft] = useState('');
  const [auditFromDraft, setAuditFromDraft] = useState('');
  const [auditToDraft, setAuditToDraft] = useState('');
  const [auditFilters, setAuditFilters] = useState({ search: '', action: '', from: '', to: '', page: 1 });
  const [reportType, setReportType] = useState<AdminReportType>('platform-overview');
  const [reportFilters, setReportFilters] = useState({ startDate: '', endDate: '', status: '', role: '', category: '', actor: '', eventType: '', outcome: '' });
  const [report, setReport] = useState<AdminReport | null>(null);
  const [reportSnapshotId, setReportSnapshotId] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<AdminReportFormat>('pdf');
  const [exportLoading, setExportLoading] = useState(false);
  const [reportStep, setReportStep] = useState<1 | 2 | 3>(1);
  const [reportBuilderOpen, setReportBuilderOpen] = useState(false);
  const [reportTypeSearch, setReportTypeSearch] = useState('');
  const [datePreset, setDatePreset] = useState<ReportDatePreset>('all');
  const [selectedReportColumns, setSelectedReportColumns] = useState<string[]>(adminReportDefinitions['platform-overview'].fields.map((field) => field.key));
  const [lastSuccessfulExport, setLastSuccessfulExport] = useState<{ filename: string; exportedAt: string } | null>(null);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [employerVerificationSummary, setEmployerVerificationSummary] = useState<AdminEmployerVerificationSummary | null>(null);
  const [diagnostics, setDiagnostics] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadErrors, setLoadErrors] = useState<Record<string, string>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);
  const loadRequestId = useRef(0);

  // Decision Modal State
  const [selectedVer, setSelectedVer] = useState<any | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [decisionAction, setDecisionAction] = useState<'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED'>('APPROVED');
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionAcknowledged, setDecisionAcknowledged] = useState(false);
  const [verificationDocuments, setVerificationDocuments] = useState<EmployerVerificationDocument[]>([]);
  const [verificationHistory, setVerificationHistory] = useState<EmployerVerificationHistoryItem[]>([]);
  const [verificationDetailsLoading, setVerificationDetailsLoading] = useState(false);
  const [verificationDetailsError, setVerificationDetailsError] = useState<string | null>(null);
  const [documentActionLoadingId, setDocumentActionLoadingId] = useState<string | null>(null);
  const [documentPreview, setDocumentPreview] = useState<{ url: string; contentType: string; filename: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [moderationReason, setModerationReason] = useState('');
  const [moderationLoading, setModerationLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedEmailVerification, setSelectedEmailVerification] = useState<{ userId: string; email: string; fullName: string; reviewStatus?: 'action_required' } | null>(null);
  const [emailVerificationReason, setEmailVerificationReason] = useState('');
  const [emailVerificationAcknowledged, setEmailVerificationAcknowledged] = useState(false);
  const [emailVerificationLoading, setEmailVerificationLoading] = useState(false);
  const [resendingVerificationUserId, setResendingVerificationUserId] = useState<string | null>(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState<any | null>(null);
  const [userVerificationHistory, setUserVerificationHistory] = useState<any[]>([]);
  const [userVerificationChallenge, setUserVerificationChallenge] = useState<any | null>(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [userDetailsError, setUserDetailsError] = useState<string | null>(null);
  const userDetailsRequestRef = useRef(0);
  const [selectedJobDetails, setSelectedJobDetails] = useState<any | null>(null);
  const [selectedAdminJob, setSelectedAdminJob] = useState<any | null>(null);
  const [adminJobStatus, setAdminJobStatus] = useState<'ACTIVE' | 'PAUSED' | 'CLOSED'>('PAUSED');
  const [adminJobReason, setAdminJobReason] = useState('');
  const [adminJobModerationLoading, setAdminJobModerationLoading] = useState(false);
  const selectedEmployerId = selectedVer?.employerId as string | undefined;

  useEffect(() => {
    if (!selectedEmployerId) {
      setVerificationDocuments([]);
      setVerificationHistory([]);
      setVerificationDetailsError(null);
      setVerificationDetailsLoading(false);
      return;
    }
    let current = true;
    setVerificationDetailsLoading(true);
    setVerificationDetailsError(null);
    void Promise.allSettled([
      api.getAdminEmployerVerificationDocuments(selectedEmployerId),
      api.getAdminEmployerVerificationHistory(selectedEmployerId),
    ]).then(([documentsResult, historyResult]) => {
      if (!current) return;
      const errors: string[] = [];
      if (documentsResult.status === 'fulfilled') setVerificationDocuments(documentsResult.value);
      else errors.push(documentsResult.reason instanceof Error ? documentsResult.reason.message : 'Documents could not be loaded.');
      if (historyResult.status === 'fulfilled') setVerificationHistory(historyResult.value);
      else errors.push(historyResult.reason instanceof Error ? historyResult.reason.message : 'Review history could not be loaded.');
      setVerificationDetailsError(errors.length ? errors.join(' ') : null);
      setVerificationDetailsLoading(false);
    });
    return () => { current = false; };
  }, [selectedEmployerId]);

  useEffect(() => () => {
    if (documentPreview) URL.revokeObjectURL(documentPreview.url);
  }, [documentPreview]);

  const changeSection = (section: AdminSection) => {
    setSearchParams(section === 'overview' ? {} : { section });
    setMobileMenuOpen(false);
    if (mobileMenuOpen) requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus());
  };

  const toggleSidebar = () => setSidebarCollapsed((collapsed) => {
    const next = !collapsed;
    localStorage.setItem('skillbridge_admin_sidebar_collapsed', String(next));
    return next;
  });

  const moveSidebar = (side: 'left' | 'right') => {
    setSidebarSide(side);
    localStorage.setItem('skillbridge_admin_sidebar_side', side);
  };

  const getMaxSidebarWidth = () => {
    const availableWidth = sidebarLayoutRef.current?.clientWidth ?? (typeof window === 'undefined' ? 1536 : window.innerWidth);
    return Math.max(MIN_SIDEBAR_WIDTH, availableWidth - MIN_MAIN_CONTENT_WIDTH);
  };

  const resizeSidebar = (width: number) => {
    const nextWidth = Math.min(getMaxSidebarWidth(), Math.max(MIN_SIDEBAR_WIDTH, width));
    setSidebarWidth(nextWidth);
    localStorage.setItem('skillbridge_admin_sidebar_width', String(nextWidth));
  };

  const handleSidebarResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sidebarResizeDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidth,
      direction: sidebarSide === 'left' ? 1 : -1,
    };
    setSidebarResizing(true);
  };

  const handleSidebarResizePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = sidebarResizeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    resizeSidebar(drag.startWidth + drag.direction * (event.clientX - drag.startX));
  };

  const handleSidebarResizePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (sidebarResizeDragRef.current?.pointerId !== event.pointerId) return;
    sidebarResizeDragRef.current = null;
    setSidebarResizing(false);
  };

  const handleSidebarResizePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (sidebarResizeDragRef.current?.pointerId !== event.pointerId) return;
    handleSidebarResizePointerMove(event);
    handleSidebarResizePointerEnd(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSidebarResizeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setSidebarResizeMode(false);
      return;
    }
    const step = event.shiftKey ? 32 : 16;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      if (!sidebarResizeMode) setSidebarResizeMode(true);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      resizeSidebar(sidebarWidth + direction * step * (sidebarSide === 'left' ? 1 : -1));
    }
  };

  const renderSectionNavigation = (collapsed = false) => adminNavGroups.map(({ label: groupLabel, items }) => (
    <div key={groupLabel} className="space-y-1">
      {!collapsed && <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 first:pt-0 dark:text-slate-500">{groupLabel}</p>}
      {items.map(({ id, label, emoji }) => {
        const selected = activeTab === id;
        const count = id === 'verifications' && metrics ? metrics.pendingEmployers : undefined;
        return (
          <button key={id} type="button" onClick={() => changeSection(id)} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} aria-current={selected ? 'page' : undefined}
            className={`group relative flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 ${collapsed ? 'justify-center px-2' : ''} ${selected ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-950 shadow-sm after:absolute after:inset-y-2 after:left-0 after:w-0.5 after:rounded-r-full after:bg-cyan-500 dark:border-cyan-300/20 dark:bg-cyan-300/10 dark:text-cyan-100 dark:after:bg-cyan-300' : 'border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white/70 hover:text-slate-950 dark:text-slate-300 dark:hover:border-slate-700/70 dark:hover:bg-slate-800/70 dark:hover:text-white'}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center text-xl leading-none" aria-hidden="true">{emoji}</span>
            {collapsed ? <span className="sr-only">{label}</span> : <><span className="min-w-0 flex-1 truncate">{label}</span>{count !== undefined && <span className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${selected ? 'bg-cyan-100 text-cyan-950 dark:bg-cyan-900/60 dark:text-cyan-100' : 'bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-400'}`}>{count}</span>}</>}
          </button>
        );
      })}
    </div>
  ));

  const loadAdminData = async () => {
    const requestId = ++loadRequestId.current;
    const shouldLoadVerifications = activeTab === 'overview' || activeTab === 'verifications';
    const shouldLoadUsers = activeTab === 'overview' || activeTab === 'users';
    const shouldLoadAudit = activeTab === 'overview' || activeTab === 'audit';
    const shouldLoadJobs = activeTab === 'jobs';
    const shouldLoadMetrics = activeTab === 'overview' || activeTab === 'verifications' || activeTab === 'jobs';
    const shouldLoadDiagnostics = activeTab === 'overview' || activeTab === 'diagnostics' || activeTab === 'ai';
    setLoading((shouldLoadMetrics && metrics === null)
      || (shouldLoadVerifications && verifications === null)
      || (shouldLoadUsers && users === null)
      || (shouldLoadAudit && auditLogs === null)
      || (shouldLoadJobs && adminJobs === null)
      || (shouldLoadDiagnostics && diagnostics === null));
    setRefreshing(true);
    const [verificationResult, verificationSummaryResult, userResult, auditResult, metricsResult, diagnosticsResult, jobsResult] = await Promise.allSettled([
      shouldLoadVerifications ? api.getAdminVerifications({
        page: verificationFilters.page,
        pageSize: 25,
        search: verificationFilters.search || undefined,
        status: verificationFilters.status || undefined,
        emailStatus: verificationFilters.emailStatus || undefined,
        sort: verificationFilters.sort,
        direction: verificationFilters.direction,
      }) : Promise.resolve(null),
      shouldLoadVerifications ? api.getAdminEmployerVerificationSummary() : Promise.resolve(null),
      shouldLoadUsers ? api.getAdminUsers({
        page: userFilters.page,
        pageSize: 25,
        search: userFilters.search || undefined,
        role: userFilters.role || undefined,
        status: userFilters.status || undefined,
        emailStatus: userFilters.emailStatus || undefined,
      }) : Promise.resolve(null),
      shouldLoadAudit ? api.getAdminAuditLogs({
        page: auditFilters.page,
        pageSize: 25,
        search: auditFilters.search || undefined,
        action: auditFilters.action || undefined,
        from: auditFilters.from || undefined,
        to: auditFilters.to || undefined,
      }) : Promise.resolve(null),
      shouldLoadMetrics ? api.getAdminMetrics() : Promise.resolve(null),
      shouldLoadDiagnostics ? api.getAdminDiagnostics() : Promise.resolve(null),
      shouldLoadJobs ? api.getAdminJobs({ page: jobFilters.page, pageSize: 25, search: jobFilters.search || undefined, status: jobFilters.status || undefined }) : Promise.resolve(null),
    ]);
    if (requestId !== loadRequestId.current) return;
    const errors: Record<string, string> = {};
    const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : 'Request failed. Please retry.';

    if (shouldLoadVerifications) {
      if (verificationResult.status === 'fulfilled') setVerifications(verificationResult.value);
      else errors.verifications = errorMessage(verificationResult.reason);
      if (verificationSummaryResult.status === 'fulfilled') setEmployerVerificationSummary(verificationSummaryResult.value);
      else errors.verificationSummary = errorMessage(verificationSummaryResult.reason);
    }
    if (shouldLoadUsers) {
      if (userResult.status === 'fulfilled') setUsers(userResult.value);
      else errors.users = errorMessage(userResult.reason);
    }
    if (shouldLoadAudit) {
      if (auditResult.status === 'fulfilled') setAuditLogs(auditResult.value);
      else errors.audit = errorMessage(auditResult.reason);
    }
    if (shouldLoadMetrics) {
      if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value);
      else errors.metrics = errorMessage(metricsResult.reason);
    }
    if (shouldLoadDiagnostics) {
      if (diagnosticsResult.status === 'fulfilled') setDiagnostics(diagnosticsResult.value);
      else errors.diagnostics = errorMessage(diagnosticsResult.reason);
    }
    if (shouldLoadJobs) {
      if (jobsResult.status === 'fulfilled') setAdminJobs(jobsResult.value);
      else errors.jobs = errorMessage(jobsResult.reason);
    }

    setLoadErrors(errors);
    if (Object.keys(errors).length === 0) setLastRefreshedAt(new Date().toISOString());
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    void loadAdminData();
  }, [activeTab, verificationFilters, userFilters, auditFilters, jobFilters]);

  useEffect(() => {
    const clampSidebarWidth = () => {
      if (!window.matchMedia('(min-width: 768px)').matches) return;
      setSidebarWidth((currentWidth) => {
        const nextWidth = Math.min(getMaxSidebarWidth(), Math.max(MIN_SIDEBAR_WIDTH, currentWidth));
        if (nextWidth !== currentWidth) localStorage.setItem('skillbridge_admin_sidebar_width', String(nextWidth));
        return nextWidth;
      });
    };
    clampSidebarWidth();
    window.addEventListener('resize', clampSidebarWidth);
    return () => window.removeEventListener('resize', clampSidebarWidth);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        mobileMenuTriggerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => mobileMenuCloseRef.current?.focus());
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobileMenuOpen]);

  const trapMobileMenuFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const focusable = [...(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleOpenDecisionModal = (ver: any, action: 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED') => {
    setActionError(null);
    setActionSuccess(null);
    setSelectedVer(ver);
    setDecisionAction(action);
    setDecisionAcknowledged(false);
    setReviewNotes(
      action === 'APPROVED'
        ? 'Record the submitted business information considered and the basis for the internal decision. Do not claim unavailable documents or an external registry were checked.'
        : action === 'RESUBMISSION_REQUIRED'
          ? 'Describe the missing business information or document needed for internal review.'
          : 'Record the specific inconsistency in the submitted business information or supporting documents.'
    );
  };

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVer || !decisionAcknowledged) return;
    setDecisionLoading(true);
    try {
      await api.reviewVerification(selectedVer.id, decisionAction, reviewNotes);
      setSelectedVer(null);
      setActionError(null);
      setActionSuccess(`Business verification decision recorded for ${selectedVer.companyName}.`);
      await loadAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Decision failed. Please retry.');
    } finally {
      setDecisionLoading(false);
    }
  };

  const reviewVerificationDocument = async (
    document: EmployerVerificationDocument,
    status: EmployerVerificationDocument['status'],
    notes: string,
  ) => {
    setDocumentActionLoadingId(document.id);
    setActionError(null);
    try {
      await api.reviewEmployerVerificationDocument(document.id, status, notes.trim());
      const [documents, history] = await Promise.all([
        api.getAdminEmployerVerificationDocuments(document.employerId),
        api.getAdminEmployerVerificationHistory(document.employerId),
      ]);
      setVerificationDocuments(documents);
      setVerificationHistory(history);
      setActionSuccess(`Document review recorded for ${document.originalFilename}.`);
      await loadAdminData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Document review could not be recorded.');
    } finally {
      setDocumentActionLoadingId(null);
    }
  };

  const previewVerificationDocument = async (document: EmployerVerificationDocument) => {
    setDocumentActionLoadingId(document.id);
    setActionError(null);
    try {
      const blob = await api.getAdminEmployerVerificationDocumentFile(document.employerId, document.id, 'inline');
      setDocumentPreview({
        url: URL.createObjectURL(blob),
        contentType: document.contentType,
        filename: document.originalFilename,
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Document preview could not be loaded.');
    } finally {
      setDocumentActionLoadingId(null);
    }
  };

  const downloadVerificationDocument = async (document: EmployerVerificationDocument) => {
    setDocumentActionLoadingId(document.id);
    setActionError(null);
    try {
      const blob = await api.getAdminEmployerVerificationDocumentFile(document.employerId, document.id, 'attachment');
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.originalFilename.replace(/[\\/]/g, '_');
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Document download could not be started.');
    } finally {
      setDocumentActionLoadingId(null);
    }
  };

  const resendEmployerVerificationEmail = async (verification: any) => {
    const userId = verification.userId;
    setResendingVerificationUserId(userId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await api.resendAdminUserVerificationEmail(userId);
      setActionSuccess(`${result.message} The code expires ${new Date(result.expiresAt).toLocaleString()}.`);
      await loadAdminData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Verification email could not be sent.');
    } finally {
      setResendingVerificationUserId(null);
    }
  };

  const handleManualEmployerEmailVerification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedEmailVerification || !emailVerificationAcknowledged || emailVerificationReason.trim().length < 3) return;
    const target = selectedEmailVerification;
    setEmailVerificationLoading(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.verifyAdminUserEmail(target.userId, emailVerificationReason.trim());
      setActionSuccess(`Email marked verified after administrator review for ${target.email}. Account and employer business status were not changed.`);
      setSelectedEmailVerification(null);
      setEmailVerificationReason('');
      setEmailVerificationAcknowledged(false);
      await loadAdminData();
      if (selectedUserDetails?.id === target.userId) await openUserDetails({ id: target.userId });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Manual email verification could not be recorded.');
    } finally {
      setEmailVerificationLoading(false);
    }
  };

  const openUserDetails = async (user: any) => {
    const requestId = ++userDetailsRequestRef.current;
    setSelectedUserDetails(user);
    setUserVerificationHistory([]);
    setUserVerificationChallenge(null);
    setUserDetailsError(null);
    setUserDetailsLoading(true);
    try {
      const details = await api.getAdminUserEmailVerificationDetails(user.id);
      if (requestId !== userDetailsRequestRef.current) return;
      setSelectedUserDetails(details.user);
      setUserVerificationHistory(details.auditHistory ?? []);
      setUserVerificationChallenge(details.challenge ?? null);
    } catch (error) {
      if (requestId !== userDetailsRequestRef.current) return;
      setUserDetailsError(error instanceof Error ? error.message : 'Account verification details could not be loaded.');
    } finally {
      if (requestId === userDetailsRequestRef.current) setUserDetailsLoading(false);
    }
  };

  const resendUserVerificationEmail = async (user: any) => {
    setResendingVerificationUserId(user.id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await api.resendAdminUserVerificationEmail(user.id);
      setActionSuccess(`${result.message} The code expires ${new Date(result.expiresAt).toLocaleString()}.`);
      await loadAdminData();
      await openUserDetails(user);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Verification email could not be sent.');
    } finally {
      setResendingVerificationUserId(null);
    }
  };

  const handleConfirmModeration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedUser) return;
    setModerationLoading(true);
    try {
      await api.moderateUser(selectedUser.id, !selectedUser.isActive, moderationReason.trim());
      setSelectedUser(null);
      setModerationReason('');
      setActionError(null);
      await loadAdminData();
    } catch (err: any) {
      setActionError(err.message || 'Moderation failed. Please retry.');
    } finally {
      setModerationLoading(false);
    }
  };

  const handleConfirmAdminJobModeration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAdminJob) return;
    setAdminJobModerationLoading(true);
    try {
      await api.moderateAdminJob(selectedAdminJob.id, adminJobStatus, adminJobReason.trim());
      setSelectedAdminJob(null);
      setAdminJobReason('');
      setActionError(null);
      await loadAdminData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Job moderation failed. Please retry.');
    } finally {
      setAdminJobModerationLoading(false);
    }
  };

  const generateReport = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setReportLoading(true);
    setReportError(null);
    setReportSuccess(null);
    setReport(null);
    setReportSnapshotId(null);
    try {
      const result = await api.getAdminReport({
        type: reportType,
        startDate: reportFilters.startDate || undefined,
        endDate: reportFilters.endDate || undefined,
        status: reportFilters.status || undefined,
        role: reportFilters.role || undefined,
        category: reportFilters.category || undefined,
        actor: reportFilters.actor || undefined,
        eventType: reportFilters.eventType || undefined,
        outcome: reportFilters.outcome || undefined,
        columns: selectedReportColumns,
      });
      setReport(result.report);
      setReportSnapshotId(result.snapshotId);
      setReportStep(3);
    } catch (error) {
      setReport(null);
      setReportError(error instanceof Error ? error.message : 'Report could not be generated. Please retry.');
    } finally {
      setReportLoading(false);
    }
  };

  const exportReport = async () => {
    if (!reportSnapshotId || !report) return;
    setExportLoading(true);
    setReportError(null);
    setReportSuccess(null);
    try {
      const file = await api.exportAdminReport(reportSnapshotId, exportFormat);
      const objectUrl = URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setReportSuccess(`${file.filename} downloaded.`);
      setLastSuccessfulExport({ filename: file.filename, exportedAt: new Date().toISOString() });
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Report export failed. Please retry.');
    } finally {
      setExportLoading(false);
    }
  };

  const updateReportFilter = (key: keyof typeof reportFilters, value: string) => {
    setReportFilters((current) => ({ ...current, [key]: value }));
    if (key === 'startDate' || key === 'endDate') setDatePreset('custom');
    setReport(null);
    setReportSnapshotId(null);
    setReportError(null);
    setReportSuccess(null);
  };

  const startReportBuilder = () => {
    setReportBuilderOpen(true);
    setReportStep(1);
    setReportError(null);
    setReportSuccess(null);
  };

  const resetReportConfiguration = () => {
    setReportFilters({ startDate: '', endDate: '', status: '', role: '', category: '', actor: '', eventType: '', outcome: '' });
    setDatePreset('all');
    setSelectedReportColumns(adminReportDefinitions[reportType].fields.map((field) => field.key));
    setExportFormat('pdf');
    setReport(null);
    setReportSnapshotId(null);
    setReportError(null);
    setReportSuccess(null);
  };

  const reportDateFiltersSupported = !['system-health', 'ai-integration-usage'].includes(reportType);
  const selectedReportDefinition = adminReportDefinitions[reportType];
  const availableReportDefinitions = Object.entries(adminReportDefinitions).filter(([type, definition]) =>
    type === reportType || `${definition.label} ${definition.category} ${definition.description}`.toLowerCase().includes(reportTypeSearch.toLowerCase())
  );

  return (
    <div className="dashboard-shell dashboard-shell-admin min-h-screen text-slate-950 dark:text-slate-100">
      <header className="sb-glass sticky top-0 z-30 border-b border-white/60 bg-white/75 shadow-sm shadow-slate-950/[0.03] backdrop-blur-xl dark:border-slate-700/60 dark:bg-[#0b1727]/75">
        <div className="mx-auto flex min-h-[68px] max-w-screen-2xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button ref={mobileMenuTriggerRef} type="button" onClick={() => setMobileMenuOpen(true)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-700 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-800 md:hidden" aria-label="Open admin navigation" aria-expanded={mobileMenuOpen} aria-controls="admin-mobile-navigation"><Menu className="h-5 w-5" aria-hidden="true" /></button>
            <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
            <div className="hidden min-w-0 sm:block">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Governance <span className="px-1 text-slate-300 dark:text-slate-600">/</span> Administration</p>
              <h1 className="truncate text-base font-bold text-slate-950 dark:text-white">{activeSection.title}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <div ref={sidebarLayoutRef} style={{ userSelect: sidebarResizing ? 'none' : undefined }} className={`mx-auto flex min-h-[calc(100vh-68px)] max-w-screen-2xl items-stretch ${sidebarSide === 'right' ? 'flex-row-reverse' : ''}`}>
        <aside style={{ width: sidebarCollapsed ? 76 : sidebarWidth }} className={`sb-glass sticky top-[68px] relative hidden h-[calc(100vh-68px)] shrink-0 flex-col ${sidebarSide === 'right' ? 'border-l shadow-[-8px_0_32px_rgba(15,23,42,0.03)]' : 'border-r shadow-[8px_0_32px_rgba(15,23,42,0.03)]'} border-white/60 bg-white/55 px-3 py-5 backdrop-blur-xl ${sidebarResizing ? 'select-none' : 'transition-[width] duration-200'} dark:border-slate-700/60 dark:bg-[#0b1727]/55 md:flex`} aria-label="Admin sidebar">
          {sidebarResizeMode && <p className="mb-3 rounded-lg border border-cyan-300/40 bg-cyan-50/80 px-2 py-1.5 text-center text-[10px] font-semibold text-cyan-900 dark:border-cyan-700/50 dark:bg-cyan-950/40 dark:text-cyan-100" role="status">Resize: drag edge or use ← / → · Esc to finish</p>}
          <div className={`mb-5 flex items-center ${sidebarCollapsed ? 'flex-col justify-center gap-2' : 'justify-between gap-2 px-1'}`}>
            {!sidebarCollapsed ? <BrandLogo size="sm" showSubtitle={false} /> : <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/30 bg-[#10243c] text-[10px] font-extrabold tracking-wide text-cyan-200" aria-label="SKILLBRIDGE ET" title="SKILLBRIDGE ET">SB</span>}
            <button type="button" draggable onClick={() => moveSidebar(sidebarSide === 'left' ? 'right' : 'left')} onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'admin-sidebar'); setSidebarDragging(true); }} onDragEnd={() => setSidebarDragging(false)} className="inline-flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm transition-colors hover:border-cyan-400 hover:text-cyan-800 active:cursor-grabbing focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-cyan-200" aria-label={`Move admin sidebar to the ${sidebarSide === 'left' ? 'right' : 'left'} side`} title={`Drag to the far left or right edge, or click to move ${sidebarSide === 'left' ? 'right' : 'left'}`}>
              {sidebarSide === 'left' ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button type="button" onClick={toggleSidebar} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 text-slate-600 shadow-sm transition-colors hover:border-cyan-400 hover:text-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:text-cyan-200" aria-label={sidebarCollapsed ? 'Expand admin navigation' : 'Collapse admin navigation'} title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}>
              <ChevronRight className={`h-4 w-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
          </div>
          {!sidebarCollapsed && <div className="mb-4 rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700 dark:text-slate-200">Governance</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Platform administration</p></div>}
          <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3" aria-label="Administrative sections">{renderSectionNavigation(sidebarCollapsed)}</nav>
          {!sidebarCollapsed && <div className="mt-auto rounded-xl border border-slate-200/70 bg-white/50 px-3 py-2.5 text-[11px] leading-5 text-slate-500 backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-400">Restricted administrative workspace</div>}
          <button type="button" onContextMenu={(event) => { event.preventDefault(); setSidebarResizeMode((enabled) => !enabled); }} onPointerDown={handleSidebarResizePointerDown} onPointerMove={handleSidebarResizePointerMove} onPointerUp={handleSidebarResizePointerUp} onPointerCancel={handleSidebarResizePointerEnd} onLostPointerCapture={handleSidebarResizePointerEnd} onKeyDown={handleSidebarResizeKeyDown} tabIndex={0} aria-label="Resize admin sidebar. Drag the edge to resize; right-click to toggle keyboard resize mode." aria-valuemin={MIN_SIDEBAR_WIDTH} aria-valuemax={getMaxSidebarWidth()} aria-valuenow={sidebarWidth} aria-orientation="vertical" role="separator" className={`absolute inset-y-0 z-10 hidden w-3 cursor-col-resize touch-none bg-transparent outline-none focus-visible:bg-cyan-400/20 md:block ${sidebarSide === 'left' ? '-right-1.5' : '-left-1.5'} ${sidebarResizeMode ? 'bg-cyan-400/10' : ''}`} />
        </aside>

        {mobileMenuOpen && <div className="fixed inset-0 top-[68px] z-40">
          <button type="button" className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-[2px]" aria-label="Close admin navigation" onClick={() => { setMobileMenuOpen(false); mobileMenuTriggerRef.current?.focus(); }} />
          <aside id="admin-mobile-navigation" role="dialog" aria-modal="true" aria-labelledby="admin-mobile-navigation-title" onKeyDown={trapMobileMenuFocus} className="absolute inset-y-0 left-0 w-[min(20rem,calc(100vw-2.5rem))] overflow-y-auto border-r border-white/60 bg-white/90 p-4 shadow-2xl shadow-slate-950/20 backdrop-blur-xl dark:border-slate-700 dark:bg-[#0b1727]/95" aria-label="Mobile admin navigation">
            <div className="mb-5 flex items-center justify-between"><div><BrandLogo size="sm" showSubtitle={false} /><span id="admin-mobile-navigation-title" className="sr-only">Administration navigation</span></div><button ref={mobileMenuCloseRef} type="button" onClick={() => { setMobileMenuOpen(false); mobileMenuTriggerRef.current?.focus(); }} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Close admin navigation"><X className="h-5 w-5" /></button></div>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-700 dark:text-slate-200">Governance</p><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{activeSection.title}</p></div>
            <nav className="space-y-4" aria-label="Administrative sections">{renderSectionNavigation()}</nav>
          </aside>
        </div>}

        <main className="min-w-0 flex-1 space-y-5 px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-300">SKILLBRIDGE ET <span className="px-1 text-slate-400">/</span> Governance</p>
            <h2 id="admin-page-title" className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{activeSection.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{activeSection.description}</p>
          </div>
          {activeTab !== 'settings' && <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">{lastRefreshedAt ? `Updated ${new Date(lastRefreshedAt).toLocaleTimeString()}` : loading ? 'Loading live data…' : 'Data not refreshed'}</p>
            <button type="button" onClick={() => void loadAdminData()} disabled={refreshing} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/65 px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-cyan-400 hover:text-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:text-cyan-200" aria-label={refreshing ? 'Refreshing page data' : 'Refresh page data'}>
              <RefreshCw className={`h-3.5 w-3.5 text-cyan-700 dark:text-cyan-300 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh
            </button>
          </div>}
        </div>
      {Object.keys(loadErrors).length > 0 && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
          <p className="font-semibold">Some governance data is unavailable.</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {Object.entries(loadErrors).map(([section, message]) => <li key={section}>{section}: {message}</li>)}
          </ul>
          <p className="mt-2 text-xs">Use Refresh to retry. Failed requests are not displayed as zero records.</p>
        </div>
      )}
        {actionError && <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{actionError}</div>}

      {activeTab === 'management' && <AdminManagement />}

      {activeTab === 'overview' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Candidates', value: metrics ? metrics.registeredCandidates ?? 0 : loadErrors.metrics ? '—' : loading ? '…' : '—', detail: metrics ? `${metrics.activeCandidates} active · ${metrics.suspendedCandidates} suspended` : 'Registered job seekers', Icon: Users, accent: 'text-cyan-700 dark:text-cyan-300' },
          { label: 'Verified Employers', value: metrics ? metrics.verifiedEmployers ?? 0 : loadErrors.metrics ? '—' : loading ? '…' : '—', detail: metrics ? `${metrics.pendingEmployers} pending review` : 'Approved organizations', Icon: Building2, accent: 'text-emerald-700 dark:text-emerald-300' },
          { label: 'Active Jobs', value: metrics ? metrics.totalJobs ?? 0 : loadErrors.metrics ? '—' : loading ? '…' : '—', detail: metrics ? `${metrics.draftJobs} drafts · ${metrics.closedJobs} closed` : 'Published and eligible', Icon: Briefcase, accent: 'text-sky-700 dark:text-sky-300' },
          { label: 'Applications', value: metrics ? metrics.totalApplications ?? 0 : loadErrors.metrics ? '—' : loading ? '…' : '—', detail: metrics ? `${metrics.applicationsAwaitingReview} pending review` : 'Submitted applications', Icon: FileText, accent: 'text-indigo-700 dark:text-indigo-300' },
        ].map(({ label, value, detail, Icon, accent }) => (
          <DashboardMetricCard
            key={label}
            label={label}
            value={value}
            detail={detail}
            icon={Icon}
            iconClassName={accent}
            className="border-white/70 bg-white/70 px-4 py-3 backdrop-blur-md hover:border-cyan-500/50 dark:border-slate-700/70 dark:bg-slate-900/55 dark:hover:border-cyan-700/70 sm:px-5"
          />
        ))}
      </div>}
      {/* Selected section content */}

      {activeTab === 'jobs' && (
        <section aria-labelledby="admin-jobs-status-title" className="space-y-4">
          <div>
            <h3 id="admin-jobs-status-title" className="text-sm font-bold text-slate-900 dark:text-white">Job publishing status</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Live status counts reported by the platform.</p>
          </div>
          {loading && !metrics ? (
            <p className="rounded-xl border border-slate-200/70 bg-white/60 px-4 py-6 text-sm text-slate-500 dark:border-slate-700/70 dark:bg-slate-900/50 dark:text-slate-400">Loading job status…</p>
          ) : metrics ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                { label: 'Active jobs', value: metrics.totalJobs },
                { label: 'Draft jobs', value: metrics.draftJobs },
                { label: 'Paused jobs', value: metrics.pausedJobs },
                { label: 'Closed jobs', value: metrics.closedJobs },
                { label: 'Expired jobs', value: metrics.expiredJobs },
              ].map(({ label, value }) => (
                <article key={label} className="rounded-2xl border border-white/70 bg-white/70 px-4 py-4 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/55">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-bold leading-none text-slate-950 dark:text-white">{value}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">Job status counts are unavailable. Refresh to retry.</p>
          )}

          <section className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800" aria-label="Job moderation queue">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Job moderation queue</h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{adminJobs?.count ?? (loadErrors.jobs ? 'Unavailable' : 'Loading…')} records · changes are recorded in the audit log</p>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); setJobFilters((current) => ({ ...current, search: jobSearchDraft.trim(), page: 1 })); }} className="flex flex-wrap items-center gap-2">
                <label className="min-w-48 flex-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className="sr-only">Search jobs</span>
                  <input value={jobSearchDraft} onChange={(event) => setJobSearchDraft(event.target.value)} maxLength={100} placeholder="Search job or employer" className="min-h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                </label>
                <label className="sr-only" htmlFor="admin-job-status-filter">Job status</label>
                <select id="admin-job-status-filter" value={jobFilters.status} onChange={(event) => setJobFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="CLOSED">Closed</option>
                  <option value="EXPIRED">Expired</option>
                </select>
                <button type="submit" disabled={refreshing} className="min-h-9 rounded-md bg-[#10243c] px-3 text-xs font-semibold text-white hover:bg-cyan-900 disabled:opacity-50 dark:bg-cyan-800 dark:hover:bg-cyan-700">Search</button>
                <button type="button" disabled={refreshing} onClick={() => { setJobSearchDraft(''); setJobFilters({ search: '', status: '', page: 1 }); }} className="min-h-9 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Reset</button>
              </form>
            </div>

            {!adminJobs && loading && <p className="py-8 text-center text-sm text-slate-500" role="status">Loading job listings…</p>}
            {!adminJobs && !loading && <p className="py-8 text-center text-sm text-rose-700 dark:text-rose-300" role="alert">Job listings could not be loaded. Refresh to retry.</p>}
            {adminJobs?.data.length === 0 && <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No jobs match these filters.</p>}
            {adminJobs && adminJobs.data.length > 0 && <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr><th className="px-3 py-2.5 font-semibold">Job</th><th className="px-3 py-2.5 font-semibold">Employer</th><th className="px-3 py-2.5 font-semibold">Status</th><th className="px-3 py-2.5 font-semibold">Deadline</th><th className="px-3 py-2.5 font-semibold">Applicants</th><th className="px-3 py-2.5 text-right font-semibold">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {adminJobs.data.map((job) => {
                    const isExpired = job.isExpired === true || job.isExpired === 1 || job.isExpired === '1';
                    const displayedStatus = isExpired ? 'EXPIRED' : String(job.status);
                    return <tr key={job.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                      <td className="max-w-[280px] px-3 py-3"><p className="truncate font-semibold text-slate-900 dark:text-white">{job.title}</p><p className="mt-0.5 truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">{job.id}</p><p className="mt-1 max-w-[260px] truncate text-[10px] text-slate-500 dark:text-slate-400" title={job.summary || ''}>{job.summary || 'No job summary'}</p></td>
                      <td className="px-3 py-3"><p className="font-medium text-slate-800 dark:text-slate-200">{job.companyName}</p><p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{job.employerApproved ? 'Employer approved' : 'Employer not approved'}</p></td>
                      <td className="whitespace-nowrap px-3 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${displayedStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : displayedStatus === 'EXPIRED' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : displayedStatus === 'CLOSED' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-cyan-50 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300'}`}>{displayedStatus.replaceAll('_', ' ')}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{job.deadline ? new Date(job.deadline).toLocaleDateString() : 'No deadline'}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-600 dark:text-slate-300">{Number(job.applicantsCount ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-3 text-right"><div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => setSelectedJobDetails(job)} className="min-h-8 rounded-md border border-slate-300 px-2.5 text-[10px] font-semibold text-slate-700 hover:border-cyan-600 hover:text-cyan-900 dark:border-slate-700 dark:text-slate-200 dark:hover:text-cyan-200">View</button>
                        <button type="button" disabled={refreshing || adminJobModerationLoading} onClick={() => { setSelectedAdminJob(job); setAdminJobStatus(job.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'); setAdminJobReason(''); setActionError(null); }} className="min-h-8 rounded-md border border-amber-300 px-2.5 text-[10px] font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-900 dark:text-amber-200 dark:hover:bg-amber-950/40">Moderate</button>
                      </div></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>}
            {adminJobs && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
              <span>{adminJobs.count === 0 ? '0 jobs' : `${(adminJobs.page - 1) * adminJobs.pageSize + 1}–${Math.min(adminJobs.page * adminJobs.pageSize, adminJobs.count)} of ${adminJobs.count} jobs`} · Page {adminJobs.page} of {Math.max(adminJobs.totalPages, 1)}</span>
              <div className="flex gap-2">
                <button type="button" disabled={refreshing || adminJobs.page <= 1} onClick={() => setJobFilters((current) => ({ ...current, page: current.page - 1 }))} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button>
                <button type="button" disabled={refreshing || adminJobs.page >= adminJobs.totalPages} onClick={() => setJobFilters((current) => ({ ...current, page: current.page + 1 }))} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button>
              </div>
            </div>}
          </section>
        </section>
      )}

      {activeTab === 'overview' && (
        <>
        <section id="admin-panel-overview" aria-labelledby="admin-page-title" className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.75fr)]">
          <article className="min-w-0 rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/55">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent governance activity</h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Latest recorded administrative events</p>
              </div>
              <button type="button" onClick={() => changeSection('audit')} className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/40">
                View all <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            {!auditLogs && loading && <p className="px-5 py-8 text-center text-sm text-slate-500">Loading recent activity…</p>}
            {!auditLogs && !loading && <p className="px-5 py-8 text-center text-sm text-rose-700 dark:text-rose-300">{loadErrors.audit ? 'Audit activity is unavailable. Refresh to retry.' : 'Audit activity has not loaded.'}</p>}
            {auditLogs?.data.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No governance activity recorded yet.</p>}
            {auditLogs && auditLogs.data.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr><th className="px-4 py-2.5 font-semibold sm:px-5">Activity</th><th className="px-3 py-2.5 font-semibold">Actor</th><th className="px-3 py-2.5 font-semibold">Time</th><th className="px-4 py-2.5 text-right font-semibold sm:px-5">Outcome</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLogs.data.slice(0, 5).map((event) => {
                      const outcome = String(event.action).includes('REJECTED') ? 'Rejected' : String(event.action).includes('APPROVED') ? 'Approved' : 'Recorded';
                      const outcomeTone = outcome === 'Rejected' ? 'text-rose-700 dark:text-rose-300' : outcome === 'Approved' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300';
                      return <tr key={event.id}>
                        <td className="max-w-[240px] px-4 py-3 sm:px-5">
                          <p className="truncate font-semibold text-slate-800 dark:text-slate-200">{event.action}</p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">{event.details || event.entityType}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{event.actorName || 'System'}{event.actorRole ? <span className="ml-1 text-[10px] text-slate-400">{event.actorRole}</span> : null}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-slate-500 dark:text-slate-400">{new Date(event.createdAt).toLocaleString()}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold sm:px-5 ${outcomeTone}`}>{outcome}</td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <aside className="rounded-2xl border border-white/70 bg-white/75 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/55">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">System status</h2>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Last diagnostic: {diagnostics ? new Date(diagnostics.timestamp).toLocaleTimeString() : 'Not available'}</p>
              </div>
              <button type="button" onClick={() => changeSection('diagnostics')} className="inline-flex min-h-9 items-center gap-1 rounded px-2 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/40">
                Details <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 px-4 dark:divide-slate-800 sm:px-5">
              {[
                { label: 'Database', value: diagnostics ? `${diagnostics.database.type} · ${diagnostics.database.connected ? 'Connected' : 'Disconnected'}` : loadErrors.diagnostics ? 'Unavailable' : 'Unknown', state: diagnostics ? diagnostics.database.connected ? 'healthy' : 'failed' : 'unknown' },
                { label: 'Migrations', value: diagnostics?.database.migrations?.status || 'Unknown', state: diagnostics ? diagnostics.database.migrations?.status === 'up-to-date' ? 'healthy' : 'warning' : 'unknown' },
                { label: 'Application', value: diagnostics?.status || (loadErrors.diagnostics ? 'Unavailable' : 'Unknown'), state: diagnostics ? diagnostics.status === 'operational' ? 'healthy' : diagnostics.status === 'degraded' ? 'warning' : 'failed' : loadErrors.diagnostics ? 'failed' : 'unknown' },
                ...(['openai', 'gemini'] as const).map((provider) => {
                  const status = diagnostics?.aiProviders?.providers[provider];
                  return {
                    label: provider === 'openai' ? 'OpenAI' : 'Gemini',
                    value: status ? `${status.model} · ${status.availability}${status.structuredOutputValidated ? ' · schema validated' : ''}` : diagnostics ? 'Not configured' : 'Unknown',
                    state: status?.availability === 'available' ? 'healthy' : status?.availability === 'unavailable' ? 'failed' : diagnostics ? 'warning' : 'unknown',
                  };
                }),
              ].map((row) => <div key={row.label} className="flex min-h-12 items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{row.label}</span>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${row.state === 'healthy' ? 'text-emerald-700 dark:text-emerald-300' : row.state === 'warning' ? 'text-amber-700 dark:text-amber-300' : row.state === 'failed' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${row.state === 'healthy' ? 'bg-emerald-500' : row.state === 'warning' ? 'bg-amber-500' : row.state === 'failed' ? 'bg-rose-500' : 'bg-slate-400'}`} aria-hidden="true" />
                  {row.value}
                </span>
              </div>)}
            </div>
          </aside>
        </section>
        <section className="border-t border-white/70 pt-5 dark:border-slate-700/70" aria-labelledby="admin-quick-links-title">
          <div className="mb-3"><h2 id="admin-quick-links-title" className="text-sm font-bold text-slate-900 dark:text-white">Quick access</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Open a governance workspace</p></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {[
              { id: 'verifications', title: 'Employer Verification', detail: `${metrics?.pendingEmployers ?? '—'} awaiting review`, Icon: Building2 },
              { id: 'users', title: 'User Management', detail: users ? `${users.count.toLocaleString()} accounts` : 'Search accounts', Icon: Users },
              { id: 'audit', title: 'Audit Logs', detail: auditLogs ? `${auditLogs.count.toLocaleString()} recorded events` : 'Review governance activity', Icon: FileText },
              { id: 'diagnostics', title: 'System Health', detail: diagnostics?.status === 'operational' ? 'Services operational' : 'View service diagnostics', Icon: Activity },
              { id: 'ai', title: 'AI & Integrations', detail: diagnostics?.aiProviders?.configured ? 'Provider configuration status' : 'Review AI provider setup', Icon: Bot },
              { id: 'reports', title: 'Reports & Analytics', detail: metrics ? 'Current platform totals' : 'Operational metrics', Icon: Activity },
            ].map(({ id, title, detail, Icon }) => <button key={id} type="button" onClick={() => changeSection(id as AdminSection)} className="flex min-h-16 items-center gap-3 rounded-xl border border-white/70 bg-white/65 px-3 text-left shadow-sm backdrop-blur transition-colors hover:border-cyan-500/60 hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:border-slate-700/70 dark:bg-slate-900/50 dark:hover:border-cyan-700 dark:hover:bg-slate-800/70">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-cyan-800 dark:bg-slate-900 dark:text-cyan-300"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{title}</span><span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">{detail}</span></span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>)}
          </div>
        </section>
        </>
      )}

      {/* Employer verification queue */}
      {activeTab === 'verifications' && (
        <section id="admin-panel-verifications" aria-labelledby="admin-page-title" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Employer Verification</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Business approval and email confirmation are separate checks.</p>
            </div>
            <div className="rounded-md border border-cyan-200 bg-cyan-50 px-3 py-2 text-[11px] text-cyan-950 dark:border-cyan-900/70 dark:bg-cyan-950/40 dark:text-cyan-100">
              Internal review only; no government registry integration is available. Uploaded documents are stored privately and accessed only by authorized reviewers.
            </div>
          </div>

          {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}
          {actionSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">{actionSuccess}</p>}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Registered employers', employerVerificationSummary?.totalEmployers],
              ['Awaiting business verification', employerVerificationSummary?.awaitingBusinessVerification],
              ['Employer emails awaiting verification', employerVerificationSummary?.awaitingEmployerEmailVerification],
              ['Business verified', employerVerificationSummary?.verifiedEmployers],
              ['Rejected applications', employerVerificationSummary?.rejectedApplications],
              ['Needs more information', employerVerificationSummary?.needsMoreInformation],
              ['Documents awaiting review', employerVerificationSummary?.documentsAwaitingReview],
            ].map(([label, value]) => <article key={String(label)} className="rounded-xl border border-white/70 bg-white/75 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/60">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950 dark:text-white">
                {value === undefined ? (loadErrors.verificationSummary ? '—' : '…') : Number(value).toLocaleString()}
              </p>
            </article>)}
          </div>

          <button
            type="button"
            disabled={employerVerificationSummary === null || loadErrors.verificationSummary !== undefined}
            onClick={() => {
              setUserFilters((current) => ({ ...current, emailStatus: 'unverified', page: 1 }));
              changeSection('users');
            }}
            className="group flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-wait disabled:opacity-70 dark:border-amber-900/70 dark:bg-amber-950/40 dark:hover:border-amber-700 sm:p-5"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm dark:bg-slate-900 dark:text-amber-300"><Mail className="h-5 w-5" aria-hidden="true" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-950 dark:text-white">Accounts needing email verification</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {employerVerificationSummary
                    ? employerVerificationSummary.awaitingEmailVerification === 0
                      ? 'All registered job seeker and employer accounts have verified email.'
                      : `${employerVerificationSummary.awaitingEmailVerification.toLocaleString()} job seeker or employer account${employerVerificationSummary.awaitingEmailVerification === 1 ? '' : 's'} still need email verification.`
                    : loadErrors.verificationSummary
                      ? 'Email verification status could not be loaded.'
                      : 'Checking account verification status…'}
                </span>
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className={`text-2xl font-bold tabular-nums ${employerVerificationSummary?.awaitingEmailVerification ? 'text-amber-800 dark:text-amber-200' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {employerVerificationSummary ? employerVerificationSummary.awaitingEmailVerification.toLocaleString() : loadErrors.verificationSummary ? '—' : '…'}
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 group-hover:text-amber-800 dark:text-slate-200 dark:group-hover:text-amber-200">
                View accounts <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </span>
          </button>

          <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/85 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/75">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Submissions</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{verifications?.count ?? (loadErrors.verifications ? 'Unavailable' : 'Loading…')} employer accounts</p>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); setVerificationFilters((current) => ({ ...current, search: verificationSearchDraft.trim(), page: 1 })); }} className="flex flex-wrap items-center gap-2">
            <label className="min-w-48 flex-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="sr-only">Search submissions</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input value={verificationSearchDraft} onChange={(event) => setVerificationSearchDraft(event.target.value)} maxLength={100} placeholder="Business, account holder, or email" className="min-h-9 w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </span>
            </label>
            <label className="sr-only" htmlFor="verification-status-filter">Review status</label>
              <select id="verification-status-filter" value={verificationFilters.status} onChange={(event) => setVerificationFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">All statuses</option>
                <option value="NOT_SUBMITTED">Not submitted</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="RESUBMISSION_REQUIRED">Resubmission required</option>
              </select>
              <label className="sr-only" htmlFor="verification-email-filter">Email verification status</label>
              <select id="verification-email-filter" value={verificationFilters.emailStatus} onChange={(event) => setVerificationFilters((current) => ({ ...current, emailStatus: event.target.value as typeof current.emailStatus, page: 1 }))} className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">All email states</option>
                <option value="verified">Email verified</option>
                <option value="unverified">Email unverified</option>
                <option value="action_required">Action required</option>
              </select>
              <label className="sr-only" htmlFor="verification-sort">Sort employers</label>
              <select id="verification-sort" value={verificationFilters.sort} onChange={(event) => setVerificationFilters((current) => ({ ...current, sort: event.target.value as typeof current.sort, page: 1 }))} className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="createdAt">Submission date</option>
                <option value="companyName">Business name</option>
                <option value="email">Email</option>
                <option value="status">Business status</option>
              </select>
              <button type="button" aria-label="Reverse sort order" onClick={() => setVerificationFilters((current) => ({ ...current, direction: current.direction === 'asc' ? 'desc' : 'asc', page: 1 }))} className="min-h-9 rounded-md border border-slate-300 px-2 text-xs font-semibold dark:border-slate-700">{verificationFilters.direction === 'asc' ? 'Ascending' : 'Descending'}</button>
            <button type="submit" disabled={refreshing} className="min-h-9 rounded-md bg-[#10243c] px-3 text-xs font-semibold text-white hover:bg-cyan-900 disabled:opacity-50 dark:bg-cyan-800 dark:hover:bg-cyan-700">Search</button>
            <button type="button" disabled={refreshing} onClick={() => { setVerificationSearchDraft(''); setVerificationFilters({ search: '', status: '', emailStatus: '', sort: 'createdAt', direction: 'desc', page: 1 }); }} className="min-h-9 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Reset</button>
              </form>
            </div>

            {!verifications && loading && <p className="py-8 text-center text-sm text-slate-500">Loading verification submissions…</p>}
            {!verifications && !loading && <p className="py-8 text-center text-sm text-rose-700 dark:text-rose-300">{loadErrors.verifications ? 'Verification submissions could not be loaded.' : 'Verification submissions are unavailable.'}</p>}
            {verifications?.data.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No employer accounts match these filters.</p>}
            {verifications?.data.length ? <div className="space-y-3 p-3 md:hidden">
              {verifications.data.map((v) => <article key={v.employerId} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="break-words text-sm font-bold text-slate-950 dark:text-white">{v.companyName}</h4>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{v.accountHolderName}</p>
                    <p className="break-all text-xs text-slate-500 dark:text-slate-400">{v.contactEmail}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${v.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : v.status === 'PENDING' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : v.status === 'RESUBMISSION_REQUIRED' ? 'bg-cyan-50 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300' : v.status === 'NOT_SUBMITTED' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'}`}>{String(v.status).replaceAll('_', ' ')}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p><span className="text-slate-500">Email:</span> {v.emailVerificationStatus === 'verified' ? 'Verified' : v.emailVerificationStatus === 'action_required' ? 'Action required' : 'Needs verification'}</p>
                  <p><span className="text-slate-500">City:</span> {v.city || '—'}</p>
                  <p><span className="text-slate-500">TIN:</span> {v.tinNumber || '—'}</p>
                  <p><span className="text-slate-500">License:</span> {v.businessLicenseNo || '—'}</p>
                  <p className="col-span-2"><span className="text-slate-500">Private documents:</span> {Number(v.documentCount || 0)}</p>
                </div>
                {v.reviewNotes && <p className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">{v.reviewNotes}</p>}
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {v.status !== 'APPROVED' && v.emailVerificationStatus === 'unverified' && <button type="button" disabled={resendingVerificationUserId === v.userId} onClick={() => void resendEmployerVerificationEmail(v)} className="min-h-9 rounded-md border border-cyan-700 px-3 text-xs font-semibold text-cyan-900 disabled:opacity-50 dark:border-cyan-600 dark:text-cyan-200">{resendingVerificationUserId === v.userId ? 'Sending…' : 'Resend verification email'}</button>}
                  {v.emailVerificationStatus === 'unverified' && <button type="button" onClick={() => { setSelectedEmailVerification({ userId: v.userId, email: v.contactEmail, fullName: v.accountHolderName }); setEmailVerificationReason(''); setEmailVerificationAcknowledged(false); }} className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Manually verify email</button>}
                  {v.verificationRecordId && !['APPROVED', 'REJECTED'].includes(v.status) && <button type="button" onClick={() => handleOpenDecisionModal(v, 'APPROVED')} className="min-h-9 rounded-md bg-[#10243c] px-3 text-xs font-semibold text-white dark:bg-cyan-800">Review business</button>}
                </div>
                {!v.verificationRecordId && <p className="text-xs text-slate-500">No business-verification submission has been received.</p>}
              </article>)}
            </div> : null}
            {verifications?.data.length ? <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1040px] text-left text-xs">
                <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr><th className="px-4 py-2.5 font-semibold">Employer</th><th className="px-3 py-2.5 font-semibold">Email status</th><th className="px-3 py-2.5 font-semibold">Submitted details</th><th className="px-3 py-2.5 font-semibold">Submitted</th><th className="px-3 py-2.5 font-semibold">Business status / review</th><th className="px-4 py-2.5 text-right font-semibold">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {verifications.data.map((v) => <tr key={v.employerId} className="align-top transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                    <td className="max-w-[220px] px-4 py-3">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{v.companyName}</p>
                      <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-slate-300">{v.accountHolderName}</p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{v.contactEmail}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${v.emailVerificationStatus === 'verified' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : v.emailVerificationStatus === 'action_required' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>{v.emailVerificationStatus === 'verified' ? 'Verified' : v.emailVerificationStatus === 'action_required' ? 'Action required' : 'Needs verification'}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                      <p className="font-medium">{v.industry || 'Industry not provided'}</p>
                      <p className="mt-1 max-w-[220px] truncate text-[11px] text-slate-500 dark:text-slate-400" title={v.address || ''}>{v.address || v.website || 'No address or website provided'}</p>
                      <p><span className="text-slate-400">TIN</span> <code className="font-mono">{v.tinNumber || '—'}</code></p>
                      <p className="mt-1"><span className="text-slate-400">License</span> <code className="font-mono">{v.businessLicenseNo || '—'}</code></p>
                      <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Private documents: {Number(v.documentCount || 0)}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-300">{v.submittedAt ? new Date(v.submittedAt).toLocaleDateString() : 'Not submitted'}</td>
                    <td className="max-w-[220px] px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${v.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : v.status === 'PENDING' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : v.status === 'RESUBMISSION_REQUIRED' ? 'bg-cyan-50 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300' : v.status === 'NOT_SUBMITTED' ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'}`}>{String(v.status).replaceAll('_', ' ')}</span>
                      {(v.reviewedAt || v.reviewerName) && <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{v.reviewerName || 'Admin'}{v.reviewedAt ? ` · ${new Date(v.reviewedAt).toLocaleDateString()}` : ''}</p>}
                      {v.reviewNotes && <p className="mt-1 truncate text-[10px] text-slate-500 dark:text-slate-400" title={v.reviewNotes}>{v.reviewNotes}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex min-w-[180px] flex-wrap justify-end gap-1.5">
                        {v.emailVerificationStatus === 'unverified' && <button type="button" disabled={resendingVerificationUserId === v.userId} onClick={() => void resendEmployerVerificationEmail(v)} className="min-h-8 rounded-md border border-cyan-700 px-2.5 text-[11px] font-semibold text-cyan-900 disabled:opacity-50 dark:border-cyan-600 dark:text-cyan-200">{resendingVerificationUserId === v.userId ? 'Sending…' : 'Resend email'}</button>}
                        {v.emailVerificationStatus === 'unverified' && <button type="button" onClick={() => { setSelectedEmailVerification({ userId: v.userId, email: v.contactEmail, fullName: v.accountHolderName }); setEmailVerificationReason(''); setEmailVerificationAcknowledged(false); }} className="min-h-8 rounded-md border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Verify email</button>}
                        {v.verificationRecordId && !['APPROVED', 'REJECTED'].includes(v.status) ? <button type="button" onClick={() => handleOpenDecisionModal(v, 'APPROVED')} className="min-h-8 rounded-md bg-[#10243c] px-2.5 text-[11px] font-semibold text-white dark:bg-cyan-800">Review business</button> : <span className="text-[10px] text-slate-400">{v.verificationRecordId ? 'Finalized' : 'No submission'}</span>}
                      </div>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div> : null}

          {verifications && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
            <span>{verifications.count === 0 ? '0 submissions' : `${(verifications.page - 1) * verifications.pageSize + 1}–${Math.min(verifications.page * verifications.pageSize, verifications.count)} of ${verifications.count} submissions`} · Page {verifications.page} of {Math.max(verifications.totalPages, 1)}</span>
            <div className="flex gap-2">
              <button type="button" disabled={refreshing || verifications.page <= 1} onClick={() => setVerificationFilters((current) => ({ ...current, page: current.page - 1 }))} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button>
              <button type="button" disabled={refreshing || verifications.page >= verifications.totalPages} onClick={() => setVerificationFilters((current) => ({ ...current, page: current.page + 1 }))} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button>
            </div>
          </div>}
          </section>
        </section>
      )}

      {/* User management */}
      {activeTab === 'users' && (
        <section id="admin-panel-users" aria-labelledby="admin-page-title" className="space-y-5 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/55 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading">
              User Management <span className="font-medium text-slate-500">({users?.count ?? (loadErrors.users ? 'Unavailable' : '…')} matching accounts)</span>
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Review email verification evidence and manage access without conflating email, business, or moderation status.
            </p>
            </div>
            <button type="button" onClick={() => void loadAdminData()} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
            </button>
          </div>

          {actionError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200">{actionError}</p>}
          {actionSuccess && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">{actionSuccess}</p>}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['Total registered accounts', users?.summary?.totalAccounts],
              ['Verified email addresses', users?.summary?.verifiedEmails],
              ['Needs verification', users?.summary?.accountsNeedingVerification],
              ['Action required', users?.summary?.emailVerificationActionRequired],
              ['Suspended accounts', users?.summary?.suspendedAccounts],
            ].map(([label, value]) => <article key={String(label)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950 dark:text-white">{value === undefined ? (loadErrors.users ? '—' : '…') : Number(value).toLocaleString()}</p>
            </article>)}
          </div>

          <form onSubmit={(event) => { event.preventDefault(); setUserFilters((current) => ({ ...current, search: userSearchDraft.trim(), page: 1 })); }} className="flex flex-wrap items-end gap-3">
            <label className="min-w-48 flex-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Search accounts
              <input value={userSearchDraft} onChange={(event) => setUserSearchDraft(event.target.value)} maxLength={100} placeholder="Name, email, or account ID" className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Role
              <select value={userFilters.role} onChange={(event) => setUserFilters((current) => ({ ...current, role: event.target.value, page: 1 }))} className="mt-1 block min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">All roles</option>
                <option value="JOB_SEEKER">Job Seeker</option>
                <option value="EMPLOYER">Employer</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Status
              <select value={userFilters.status} onChange={(event) => setUserFilters((current) => ({ ...current, status: event.target.value, page: 1 }))} className="mt-1 block min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending_verification">Pending verification</option>
              </select>
            </label>
            <button type="submit" disabled={refreshing} className="min-h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50 dark:bg-teal-700">Apply filters</button>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Email verification
              <select value={userFilters.emailStatus} onChange={(event) => setUserFilters((current) => ({ ...current, emailStatus: event.target.value as typeof current.emailStatus, page: 1 }))} className="mt-1 block min-h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">All email states</option>
                <option value="unverified">Needs verification</option>
                <option value="verified">Verified</option>
                <option value="action_required">Action required</option>
              </select>
            </label>
            <button type="button" disabled={refreshing} onClick={() => { setUserSearchDraft(''); setUserFilters({ search: '', role: '', status: '', emailStatus: '', page: 1 }); }} className="min-h-10 rounded-md px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Reset</button>
          </form>

          {!users && loading && <p className="py-8 text-center text-sm text-slate-500">Loading user accounts…</p>}
          {!users && !loading && <p className="py-8 text-center text-sm text-rose-700 dark:text-rose-300">{loadErrors.users ? 'User accounts could not be loaded.' : 'User accounts are unavailable.'}</p>}
          {users?.data.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500 dark:border-slate-700">No user accounts match these filters.</p>}
          {users && users.data.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[940px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr><th className="px-3 py-2.5 font-semibold">Account</th><th className="px-3 py-2.5 font-semibold">Role</th><th className="px-3 py-2.5 font-semibold">Email verification</th><th className="px-3 py-2.5 font-semibold">Account status</th><th className="px-3 py-2.5 font-semibold">Created</th><th className="px-3 py-2.5 text-right font-semibold">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.data.map((u) => <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                  <td className="max-w-[300px] px-3 py-2.5"><p className="truncate font-semibold text-slate-800 dark:text-slate-200">{u.fullName}</p><p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-300">{u.role.replaceAll('_', ' ')}</td>
                  <td className="px-3 py-2.5"><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${u.emailVerificationStatus === 'verified' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : u.emailVerificationStatus === 'action_required' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>{u.emailVerificationStatus === 'verified' ? <ShieldCheck className="h-3 w-3" aria-hidden="true" /> : <Mail className="h-3 w-3" aria-hidden="true" />}{u.emailVerificationStatus === 'verified' ? 'Verified' : u.emailVerificationStatus === 'action_required' ? 'Action required' : 'Needs verification'}</span></td>
                  <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${u.accountStatus === 'active' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : u.accountStatus === 'pending_verification' ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'}`}>{String(u.accountStatus).replaceAll('_', ' ')}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 dark:text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2.5 text-right"><div className="flex justify-end gap-1.5">
                    {u.emailVerificationStatus === 'unverified' && ['JOB_SEEKER', 'EMPLOYER', 'ADMIN'].includes(u.role) && <button type="button" onClick={() => void resendUserVerificationEmail(u)} disabled={resendingVerificationUserId === u.id || refreshing} className="min-h-8 rounded-md border border-cyan-700 px-2.5 text-[10px] font-semibold text-cyan-900 disabled:opacity-50 dark:border-cyan-600 dark:text-cyan-200">{resendingVerificationUserId === u.id ? 'Sending…' : 'Resend OTP'}</button>}
                    {u.emailVerificationStatus === 'unverified' && u.role !== 'ADMIN' && u.id !== currentUser?.id && <button type="button" onClick={() => { setSelectedEmailVerification({ userId: u.id, email: u.email, fullName: u.fullName }); setEmailVerificationReason(''); setEmailVerificationAcknowledged(false); }} className="min-h-8 rounded-md border border-amber-600 px-2.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-200 dark:hover:bg-amber-950/40">Verify email</button>}
                    <button type="button" onClick={() => void openUserDetails(u)} className="min-h-8 rounded-md border border-slate-300 px-2.5 text-[10px] font-semibold text-slate-700 hover:border-cyan-600 hover:text-cyan-900 dark:border-slate-700 dark:text-slate-200 dark:hover:text-cyan-200">View</button>
                    {u.id === currentUser?.id
                      ? <span className="self-center text-[10px] text-slate-400">Current admin</span>
                      : u.accountStatus === 'pending_verification'
                        ? <span className="self-center text-[10px] text-slate-400">Awaiting verification</span>
                        : <button type="button" onClick={() => { setSelectedUser(u); setModerationReason(''); setActionError(null); }} disabled={refreshing || moderationLoading} className={`min-h-8 rounded-md px-2.5 text-[10px] font-semibold disabled:opacity-50 ${u.isActive ? 'border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40'}`}>{u.isActive ? 'Suspend' : 'Reactivate'}</button>}
                  </div></td>
                </tr>)}
              </tbody>
            </table>
          </div>}

          {users && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
            <span>{users.count === 0 ? '0 accounts' : `${(users.page - 1) * users.pageSize + 1}–${Math.min(users.page * users.pageSize, users.count)} of ${users.count} accounts`} · Page {users.page} of {Math.max(users.totalPages, 1)}</span>
            <div className="flex gap-2">
              <button type="button" disabled={refreshing || users.page <= 1} onClick={() => setUserFilters((current) => ({ ...current, page: current.page - 1 }))} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button>
              <button type="button" disabled={refreshing || users.page >= users.totalPages} onClick={() => setUserFilters((current) => ({ ...current, page: current.page + 1 }))} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button>
            </div>
          </div>}
        </section>
      )}

      {/* Platform audit trail */}
      {activeTab === 'audit' && (
        <section id="admin-panel-audit" aria-labelledby="admin-page-title" className="space-y-3 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/55 sm:p-5">
          <div className="border-b border-slate-100 pb-3 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Platform Audit Trail ({auditLogs?.count ?? (loadErrors.audit ? 'Unavailable' : '…')} events)
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Immutable log of significant system events, job postings, applications, and verification reviews.
            </p>
          </div>

          <form onSubmit={(event) => { event.preventDefault(); setAuditFilters((current) => ({ ...current, search: auditSearchDraft.trim(), action: auditActionDraft, from: auditFromDraft ? `${auditFromDraft}T00:00:00.000Z` : '', to: auditToDraft ? `${auditToDraft}T23:59:59.999Z` : '', page: 1 })); }} className="flex flex-wrap items-end gap-2">
            <label className="min-w-48 flex-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="sr-only">Search events</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input value={auditSearchDraft} onChange={(event) => setAuditSearchDraft(event.target.value)} maxLength={100} placeholder="Search activity or target" className="min-h-9 w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </span>
            </label>
            <label htmlFor="audit-action-filter" className="sr-only">Event type</label>
              <select id="audit-action-filter" value={auditActionDraft} onChange={(event) => setAuditActionDraft(event.target.value)} className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="">All event types</option>
                <option value="ADMIN_ACCOUNT_PROVISIONED">Admin account provisioned</option>
                <option value="USER_REGISTERED">User registered</option>
                <option value="USER_SUSPENDED">User suspended</option>
                <option value="USER_ACTIVATED">User reactivated</option>
                <option value="USER_ACCOUNT_DELETED">Account deleted</option>
                <option value="EMPLOYER_VERIFICATION_APPROVED">Employer approved</option>
                <option value="EMPLOYER_VERIFICATION_REJECTED">Employer rejected</option>
                <option value="EMPLOYER_VERIFICATION_RESUBMISSION_REQUIRED">Resubmission requested</option>
                <option value="ADMIN_JOB_STATUS_CHANGED">Admin job status changed</option>
              </select>
            <label htmlFor="audit-from-filter" className="sr-only">From date</label>
            <input id="audit-from-filter" type="date" aria-label="From date" value={auditFromDraft} max={auditToDraft || undefined} onChange={(event) => setAuditFromDraft(event.target.value)} className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <label htmlFor="audit-to-filter" className="sr-only">To date</label>
            <input id="audit-to-filter" type="date" aria-label="To date" value={auditToDraft} min={auditFromDraft || undefined} onChange={(event) => setAuditToDraft(event.target.value)} className="min-h-9 rounded-md border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            <button type="submit" disabled={refreshing} className="min-h-9 rounded-md bg-[#10243c] px-3 text-xs font-semibold text-white hover:bg-cyan-900 disabled:opacity-50 dark:bg-cyan-800 dark:hover:bg-cyan-700">Filter</button>
            <button type="button" disabled={refreshing} onClick={() => { setAuditSearchDraft(''); setAuditActionDraft(''); setAuditFromDraft(''); setAuditToDraft(''); setAuditFilters({ search: '', action: '', from: '', to: '', page: 1 }); }} className="min-h-9 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Reset</button>
          </form>

          {!auditLogs && loading && <p className="py-8 text-center text-sm text-slate-500">Loading audit events…</p>}
          {!auditLogs && !loading && <p className="py-8 text-center text-sm text-rose-700 dark:text-rose-300">{loadErrors.audit ? 'Audit events could not be loaded.' : 'Audit events are unavailable.'}</p>}
          {auditLogs?.data.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No audit events match these filters.</p>}
          {auditLogs && auditLogs.data.length > 0 && <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr><th className="px-3 py-2.5 font-semibold">Event</th><th className="px-3 py-2.5 font-semibold">Actor</th><th className="px-3 py-2.5 font-semibold">Target</th><th className="px-3 py-2.5 font-semibold">Timestamp</th><th className="px-3 py-2.5 font-semibold">Outcome</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.data.map((log) => {
                  const outcome = String(log.action).includes('REJECTED') ? 'Rejected' : String(log.action).includes('APPROVED') ? 'Approved' : 'Recorded';
                  return <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                    <td className="max-w-[260px] px-3 py-2.5"><p className="truncate font-semibold text-slate-800 dark:text-slate-200">{log.action}</p><p className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">{log.details || 'No details recorded'}</p></td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{log.actorName || 'System'}<p className="text-[10px] text-slate-400">{log.actorRole || 'SYSTEM'}</p></td>
                    <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300"><span>{log.entityType}</span><p className="font-mono text-[10px] text-slate-400">{log.entityId}</p></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 dark:text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className={`px-3 py-2.5 font-semibold ${outcome === 'Rejected' ? 'text-rose-700 dark:text-rose-300' : outcome === 'Approved' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}`}>{outcome}</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}

          {auditLogs && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800">
            <span>{auditLogs.count === 0 ? '0 events' : `${(auditLogs.page - 1) * auditLogs.pageSize + 1}–${Math.min(auditLogs.page * auditLogs.pageSize, auditLogs.count)} of ${auditLogs.count} events`} · Page {auditLogs.page} of {Math.max(auditLogs.totalPages, 1)}</span>
            <div className="flex gap-2">
              <button type="button" disabled={refreshing || auditLogs.page <= 1} onClick={() => setAuditFilters((current) => ({ ...current, page: current.page - 1 }))} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button>
              <button type="button" disabled={refreshing || auditLogs.page >= auditLogs.totalPages} onClick={() => setAuditFilters((current) => ({ ...current, page: current.page + 1 }))} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button>
            </div>
          </div>}
        </section>
      )}

      {/* System health diagnostics */}
      {activeTab === 'diagnostics' && (
        <section id="admin-panel-diagnostics" aria-labelledby="admin-page-title" className="space-y-4 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/55 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">System Health</h2>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Read-only service and database diagnostics</p>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Last checked {diagnostics ? new Date(diagnostics.timestamp).toLocaleString() : 'Not available'}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
            <span className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-semibold ${diagnostics?.status === 'operational' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200' : diagnostics?.status === 'degraded' ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200' : loadErrors.diagnostics ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}><span className={`h-1.5 w-1.5 rounded-full ${diagnostics?.status === 'operational' ? 'bg-emerald-500' : diagnostics?.status === 'degraded' ? 'bg-amber-500' : loadErrors.diagnostics ? 'bg-rose-500' : 'bg-slate-400'}`} />{diagnostics?.status === 'operational' ? 'Operational' : diagnostics?.status === 'degraded' ? 'Degraded' : loadErrors.diagnostics ? 'Unavailable' : 'Status unknown'}</span>
            <button type="button" onClick={() => void loadAdminData()} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-cyan-600 hover:text-cyan-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:text-cyan-200"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Refresh health</button>
          </div>
          {loadErrors.diagnostics && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200" role="alert">Diagnostics could not be loaded. Use Refresh to retry.</p>}

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {[
              { label: 'Database connection', value: diagnostics ? `${diagnostics.database.type} · ${diagnostics.database.connected ? 'Connected' : 'Disconnected'}` : loadErrors.diagnostics ? 'Unavailable' : 'Unknown', state: diagnostics ? diagnostics.database.connected ? 'healthy' : 'failed' : loadErrors.diagnostics ? 'failed' : 'unknown' },
              { label: 'Engine / adapter', value: diagnostics ? `${diagnostics.database.version || diagnostics.database.type} · ${diagnostics.database.orm}` : loadErrors.diagnostics ? 'Unavailable' : 'Unknown', state: diagnostics ? 'healthy' : loadErrors.diagnostics ? 'failed' : 'unknown' },
              { label: 'Migration status', value: diagnostics?.database.migrations ? `${diagnostics.database.migrations.status} · ${diagnostics.database.migrations.appliedCount ?? '?'} / ${diagnostics.database.migrations.expectedCount}` : loadErrors.diagnostics ? 'Unavailable' : 'Unknown', state: diagnostics ? diagnostics.database.migrations?.status === 'up-to-date' ? 'healthy' : 'warning' : loadErrors.diagnostics ? 'failed' : 'unknown' },
              { label: 'Application health', value: diagnostics?.status || (loadErrors.diagnostics ? 'Unavailable' : 'Unknown'), state: diagnostics ? diagnostics.status === 'operational' ? 'healthy' : diagnostics.status === 'degraded' ? 'warning' : 'failed' : loadErrors.diagnostics ? 'failed' : 'unknown' },
              { label: 'AI provider order', value: diagnostics?.aiProviders ? `${diagnostics.aiProviders.primaryProvider} primary · ${diagnostics.aiProviders.fallbackProvider} fallback` : loadErrors.diagnostics ? 'Unavailable' : 'Unknown', state: diagnostics?.aiProviders?.configured ? 'healthy' : diagnostics ? 'warning' : 'unknown' },
              ...(['openai', 'gemini'] as const).map((provider) => {
                const status = diagnostics?.aiProviders?.providers[provider];
                const usage = diagnostics?.aiProviders?.usage[provider];
                return {
                  label: provider === 'openai' ? 'OpenAI integration' : 'Gemini integration',
                  value: status
                    ? `${status.model} · ${status.availability === 'not-configured' ? 'not configured · add backend key' : status.availability}${status.structuredOutputValidated ? ' · schema validated' : ''} · ${usage?.requests ?? 0} requests`
                    : 'Not configured',
                  state: status?.availability === 'available' ? 'healthy' : status?.availability === 'unavailable' ? 'failed' : status?.availability === 'not-configured' ? 'warning' : diagnostics ? 'warning' : 'unknown',
                };
              }),
              { label: 'Optional ML service', value: diagnostics?.mlExtension.status || (loadErrors.diagnostics ? 'Unavailable' : 'Unknown'), state: diagnostics ? 'unknown' : loadErrors.diagnostics ? 'failed' : 'unknown' },
            ].map((row) => <div key={row.label} className="grid min-h-11 grid-cols-[minmax(150px,0.7fr)_minmax(0,1.3fr)] items-center gap-4 py-2 text-xs sm:grid-cols-2">
              <span className="font-medium text-slate-600 dark:text-slate-300">{row.label}</span>
              <span className={`inline-flex items-center gap-2 ${row.state === 'healthy' ? 'text-emerald-700 dark:text-emerald-300' : row.state === 'warning' ? 'text-amber-700 dark:text-amber-300' : row.state === 'failed' ? 'text-rose-700 dark:text-rose-300' : 'text-slate-700 dark:text-slate-200'}`}>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${row.state === 'healthy' ? 'bg-emerald-500' : row.state === 'warning' ? 'bg-amber-500' : row.state === 'failed' ? 'bg-rose-500' : 'bg-slate-400'}`} aria-hidden="true" />{row.value}
              </span>
            </div>)}
          </div>
          {diagnostics?.aiProviders && !diagnostics.aiProviders.configured && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            AI providers are disabled until a valid <code>OPENAI_API_KEY</code> or <code>GEMINI_API_KEY</code> is configured in the backend environment. Set it in the ignored local <code>.env</code> file or your hosting provider’s protected environment settings, then restart the backend. Never add provider keys to frontend settings or share them in chat.
          </p>}

          <details className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              Database Table Diagnostics
              <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">{diagnostics?.database.tableCounts ? `${Object.keys(diagnostics.database.tableCounts).length} tables` : 'Read-only'}</span>
            </summary>
            {diagnostics?.database.tableCounts ? <div className="grid grid-cols-1 divide-y divide-slate-100 px-3 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-slate-800">
              {Object.entries(diagnostics.database.tableCounts).map(([table, count], index) => <div key={table} className={`flex min-h-9 items-center justify-between gap-3 py-2 text-[11px] ${index > 0 ? 'sm:pl-3' : ''}`}>
                <span className="truncate font-mono text-slate-600 dark:text-slate-300">{table}</span>
                <span className="shrink-0 font-semibold text-slate-800 dark:text-slate-100">{count < 0 ? 'Unavailable' : count.toLocaleString()}</span>
              </div>)}
            </div> : <p className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400">Table diagnostics are unavailable.</p>}
          </details>
        </section>
      )}

      {activeTab === 'ai' && (
        <section aria-labelledby="admin-ai-title" className="space-y-5">
          <div className="rounded-2xl border border-white/70 bg-white/65 p-5 shadow-sm backdrop-blur-lg dark:border-slate-700/70 dark:bg-slate-900/55 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-200/70 bg-cyan-50 text-cyan-800 dark:border-cyan-800/70 dark:bg-cyan-950/50 dark:text-cyan-200"><Bot className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <h3 id="admin-ai-title" className="text-base font-bold text-slate-950 dark:text-white">AI &amp; Integrations</h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">Read-only model-access checks and request usage from the authorized system diagnostics endpoint. Model access does not guarantee available quota or successful generation; secrets are never displayed here.</p>
              </div>
            </div>
            {loadErrors.diagnostics && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">AI provider diagnostics could not be loaded. Refresh to retry.</p>}
            {!diagnostics && loading && <p className="mt-5 rounded-xl border border-slate-200 bg-white/60 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400" role="status">Loading integration status…</p>}
            {!diagnostics && !loading && !loadErrors.diagnostics && <p className="mt-5 rounded-xl border border-slate-200 bg-white/60 px-4 py-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400">Integration diagnostics are not available.</p>}
            {diagnostics?.aiProviders && (
              <>
                <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-950/40">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Provider order</span>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100">{diagnostics.aiProviders.primaryProvider} primary</span>
                  <span className="text-slate-400" aria-hidden="true">→</span>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100">{diagnostics.aiProviders.fallbackProvider} fallback</span>
                  <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold ${diagnostics.aiProviders.configured ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>{diagnostics.aiProviders.configured ? 'Provider configured' : 'No provider configured'}</span>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {(['openai', 'gemini'] as const).map((provider) => {
                    const aiProviderStatus = diagnostics.aiProviders?.providers[provider];
                    const usage = diagnostics.aiProviders?.usage[provider];
                    if (!aiProviderStatus || !usage) return null;
                    const status = aiProviderStatus;
                    const isHealthy = status.availability === 'available';
                    const isFailed = status.availability === 'unavailable';
                    return <article key={provider} className="rounded-2xl border border-white/70 bg-white/75 p-5 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/60">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">AI provider</p><h4 className="mt-1 text-lg font-bold capitalize text-slate-950 dark:text-white">{provider === 'openai' ? 'OpenAI' : 'Google Gemini'}</h4></div>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${isHealthy ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : isFailed ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${isHealthy ? 'bg-emerald-500' : isFailed ? 'bg-rose-500' : 'bg-amber-500'}`} aria-hidden="true" />{isHealthy ? 'Model access verified' : status.availability}</span>
                      </div>
                      <p className="mt-4 truncate text-sm font-medium text-slate-700 dark:text-slate-200" title={status.model}>Model · {status.model}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{status.configured ? 'Server-side credentials configured' : 'Server-side credentials not configured'}{status.structuredOutputValidated ? ' · Structured output validated' : ''}</p>
                      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200/80 pt-4 sm:grid-cols-4 dark:border-slate-700">
                        <div><dt className="text-[10px] text-slate-500 dark:text-slate-400">Requests</dt><dd className="mt-1 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{usage.requests.toLocaleString()}</dd></div>
                        <div><dt className="text-[10px] text-slate-500 dark:text-slate-400">Fallbacks</dt><dd className="mt-1 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{usage.fallbacks.toLocaleString()}</dd></div>
                        <div><dt className="text-[10px] text-slate-500 dark:text-slate-400">Failures</dt><dd className="mt-1 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{usage.failures.toLocaleString()}</dd></div>
                        <div><dt className="text-[10px] text-slate-500 dark:text-slate-400">Avg. latency</dt><dd className="mt-1 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{usage.requests ? `${usage.averageLatencyMs.toLocaleString()} ms` : '—'}</dd></div>
                      </dl>
                    </article>;
                  })}
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">Usage counters are in-memory and reset when the backend restarts. “Configured” indicates server-side setup; provider availability is confirmed by request results, not only the presence of a key.</p>
              </>
            )}
          </div>
        </section>
      )}

      {activeTab === 'reports' && (
        <section aria-labelledby="admin-reports-title" className="space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div>
              <h2 id="admin-reports-title" className="text-lg font-bold text-slate-950 dark:text-white">Reports &amp; Analytics</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Generate, customize, and export platform reports.</p>
            </div>
            <button type="button" onClick={startReportBuilder} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#10243c] px-4 text-sm font-semibold text-white hover:bg-cyan-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:bg-cyan-800 dark:hover:bg-cyan-700">
              <FileText className="h-4 w-4" aria-hidden="true" />{reportBuilderOpen ? 'Create another report' : 'Create Report'}
            </button>
          </header>

          <section aria-label="Reporting summary" className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-xl border border-slate-200/80 bg-white/75 p-4 dark:border-slate-700 dark:bg-slate-900/55">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Available report types</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-slate-950 dark:text-white">{Object.keys(adminReportDefinitions).length}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Across platform, recruitment, and governance</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white/75 p-4 dark:border-slate-700 dark:bg-slate-900/55">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Recent reports</p>
              <p className="mt-1 text-base font-bold text-slate-950 dark:text-white">History not stored</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Generated report history is not persisted yet.</p>
            </article>
            <article className="rounded-xl border border-slate-200/80 bg-white/75 p-4 dark:border-slate-700 dark:bg-slate-900/55">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Last successful export</p>
              {lastSuccessfulExport ? <>
                <p className="mt-1 truncate text-sm font-bold text-slate-950 dark:text-white" title={lastSuccessfulExport.filename}>{lastSuccessfulExport.filename}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{new Date(lastSuccessfulExport.exportedAt).toLocaleString()}</p>
              </> : <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">No export this session</p>}
            </article>
          </section>

          {reportBuilderOpen && <section aria-labelledby="report-builder-title" className="space-y-4 rounded-xl border border-slate-200/80 bg-white/75 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/55 sm:p-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 id="report-builder-title" className="text-sm font-bold text-slate-900 dark:text-white">Create a report</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Choose a report, configure fields and filters, preview the matching data, then download.</p>
                </div>
                <button type="button" onClick={() => setReportBuilderOpen(false)} className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Close builder</button>
              </div>
              <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Report creation steps">
                {(['Select report', 'Configure', 'Preview & export'] as const).map((step, index) => {
                  const stepNumber = (index + 1) as 1 | 2 | 3;
                  const isCurrent = reportStep === stepNumber;
                  const isComplete = reportStep > stepNumber;
                  return <li key={step} aria-current={isCurrent ? 'step' : undefined} className={`rounded-md border px-2 py-2 text-center text-xs font-semibold sm:px-3 ${isCurrent ? 'border-cyan-700 bg-cyan-50 text-cyan-900 dark:border-cyan-500 dark:bg-cyan-950/40 dark:text-cyan-100' : isComplete ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'}`}>
                    <span className="mr-1 hidden sm:inline">{index + 1}.</span>{step}
                  </li>;
                })}
              </ol>
            </div>
            {reportStep === 1 && <div className="space-y-4">
              <label htmlFor="report-type-search" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Find a report
                <input id="report-type-search" type="search" value={reportTypeSearch} onChange={(event) => setReportTypeSearch(event.target.value)} placeholder="Search reports by name or category" className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Report type
                <select value={reportType} onChange={(event) => {
                  const nextType = event.target.value as AdminReportType;
                  setReportType(nextType);
                  setReportFilters({ startDate: '', endDate: '', status: '', role: '', category: '', actor: '', eventType: '', outcome: '' });
                  setDatePreset('all');
                  setSelectedReportColumns(adminReportDefinitions[nextType].fields.map((field) => field.key));
                  setReport(null);
                  setReportSnapshotId(null);
                  setReportError(null);
                  setReportSuccess(null);
                }} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  {availableReportDefinitions.length === 0 && <option value={reportType}>{selectedReportDefinition.label}</option>}
                  {availableReportDefinitions.map(([type, definition]) => <option key={type} value={type}>{definition.category} · {definition.label}</option>)}
                </select>
              </label>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{selectedReportDefinition.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">{selectedReportDefinition.description}</p>
              </div>
              <button type="button" onClick={() => { setReportError(null); setReportStep(2); }} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#10243c] px-4 text-sm font-semibold text-white hover:bg-cyan-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:bg-cyan-800 dark:hover:bg-cyan-700">
                Configure report <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>}

            {reportStep === 2 && <form onSubmit={(event) => void generateReport(event)} className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div><p className="text-xs font-bold text-slate-900 dark:text-white">{selectedReportDefinition.label}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{selectedReportDefinition.description}</p></div>
                <button type="button" onClick={() => setReportStep(1)} className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Change report</button>
              </div>
              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-slate-800 dark:text-slate-100">Fields to include</legend>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedReportColumns(selectedReportDefinition.fields.map((field) => field.key))} className="min-h-8 rounded border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Select all</button>
                  <button type="button" onClick={() => setSelectedReportColumns([])} className="min-h-8 rounded border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Clear all</button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedReportDefinition.fields.map((field) => <label key={field.key} className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 px-3 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    <input type="checkbox" checked={selectedReportColumns.includes(field.key)} onChange={(event) => setSelectedReportColumns((current) => event.target.checked ? [...current, field.key] : current.filter((key) => key !== field.key))} className="h-4 w-4 accent-cyan-700" />
                    {field.label}
                  </label>)}
                </div>
                {selectedReportColumns.length === 0 && <p className="text-xs text-rose-700 dark:text-rose-300" role="alert">Select at least one field to continue.</p>}
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-slate-800 dark:text-slate-100">Date range and filters</legend>
                {reportDateFiltersSupported ? <>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Reporting period
                    <select value={datePreset} onChange={(event) => {
                      const preset = event.target.value as ReportDatePreset;
                      setDatePreset(preset);
                      if (preset !== 'custom') {
                        const range = preset === 'all' ? { startDate: '', endDate: '' } : getReportDateRange(preset);
                        setReportFilters((current) => ({ ...current, ...range }));
                        setReport(null);
                        setReportSnapshotId(null);
                        setReportError(null);
                      }
                    }} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                      <option value="all">All available dates</option><option value="today">Today</option><option value="last-7-days">Last 7 days</option><option value="last-30-days">Last 30 days</option><option value="this-month">This month</option><option value="previous-month">Previous month</option><option value="this-year">This year</option><option value="custom">Custom range</option>
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Start date
                      <input type="date" disabled={datePreset !== 'custom'} value={reportFilters.startDate} max={reportFilters.endDate || undefined} onChange={(event) => updateReportFilter('startDate', event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    </label>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">End date
                      <input type="date" disabled={datePreset !== 'custom'} value={reportFilters.endDate} min={reportFilters.startDate || undefined} onChange={(event) => updateReportFilter('endDate', event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                    </label>
                  </div>
                  {reportFilters.startDate && reportFilters.endDate && reportFilters.endDate < reportFilters.startDate && <p className="text-xs text-rose-700 dark:text-rose-300" role="alert">End date must be on or after start date.</p>}
                </> : <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">This is a point-in-time report; historical date filters are unavailable.</p>}

              {['employer-verification', 'user-management', 'jobs-moderation', 'applications'].includes(reportType) && <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Status
                <select value={reportFilters.status} onChange={(event) => updateReportFilter('status', event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="">All statuses</option>
                  {reportType === 'employer-verification' && <><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="RESUBMISSION_REQUIRED">Resubmission required</option></>}
                  {reportType === 'user-management' && <><option value="active">Active</option><option value="suspended">Suspended</option></>}
                  {reportType === 'jobs-moderation' && <><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="PAUSED">Paused</option><option value="CLOSED">Closed</option><option value="EXPIRED">Expired</option></>}
                  {reportType === 'applications' && <><option value="APPLIED">Applied</option><option value="SCREENING">Screening</option><option value="TECHNICAL_ASSESSMENT">Technical assessment</option><option value="INTERVIEW_SCHEDULED">Interview scheduled</option><option value="OFFERED">Offered</option><option value="REJECTED">Rejected</option><option value="WITHDRAWN">Withdrawn</option></>}
                </select>
              </label>}

              {reportType === 'user-management' && <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Role
                <select value={reportFilters.role} onChange={(event) => updateReportFilter('role', event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="">All roles</option><option value="JOB_SEEKER">Job seeker</option><option value="EMPLOYER">Employer</option><option value="ADMIN">Administrator</option>
                </select>
              </label>}

              {reportType === 'employer-verification' && <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Industry
                <input value={reportFilters.category} onChange={(event) => updateReportFilter('category', event.target.value)} maxLength={100} placeholder="All industries" className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>}

              {['jobs-moderation', 'applications'].includes(reportType) && <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Job category
                <select value={reportFilters.category} onChange={(event) => updateReportFilter('category', event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="">All job types</option><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="INTERNSHIP">Internship</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option>
                </select>
              </label>}

              {reportType === 'audit-activity' && <>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Actor
                  <input value={reportFilters.actor} onChange={(event) => updateReportFilter('actor', event.target.value)} maxLength={100} placeholder="Search actor name" className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Event type
                  <select value={reportFilters.eventType} onChange={(event) => updateReportFilter('eventType', event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    <option value="">All events</option><option value="USER_REGISTERED">User registered</option><option value="USER_SUSPENDED">User suspended</option><option value="USER_ACTIVATED">User reactivated</option><option value="EMPLOYER_VERIFICATION_APPROVED">Employer approved</option><option value="EMPLOYER_VERIFICATION_REJECTED">Employer rejected</option><option value="ADMIN_JOB_STATUS_CHANGED">Admin job status changed</option>
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Outcome
                  <select value={reportFilters.outcome} onChange={(event) => updateReportFilter('outcome', event.target.value)} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    <option value="">All outcomes</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="recorded">Recorded</option>
                  </select>
                </label>
              </>}
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-bold text-slate-800 dark:text-slate-100">Export format</legend>
                <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Choose export format">
                  {([
                    ['pdf', 'PDF', 'Print-ready document'],
                    ['xlsx', 'Excel (.xlsx)', 'Formatted workbook'],
                    ['csv', 'CSV (.csv)', 'UTF-8 spreadsheet data'],
                  ] as const).map(([format, label, description]) => <button key={format} type="button" aria-pressed={exportFormat === format} onClick={() => setExportFormat(format)} className={`min-h-16 rounded-md border px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 ${exportFormat === format ? 'border-cyan-700 bg-cyan-50 text-cyan-950 dark:border-cyan-500 dark:bg-cyan-950/40 dark:text-cyan-100' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
                    <span className="block text-xs font-bold">{label}</span><span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{description}</span>
                  </button>)}
                </div>
              </fieldset>

              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(reportFilters).some(([, value]) => value) && <>
                  {Object.entries(reportFilters).filter(([, value]) => value).map(([key, value]) => <span key={key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {key === 'startDate' ? 'From' : key === 'endDate' ? 'Through' : key}: {value}
                    <button type="button" onClick={() => updateReportFilter(key as keyof typeof reportFilters, '')} aria-label={`Remove ${key} filter`} className="rounded-full px-1 font-bold hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:hover:bg-slate-700">×</button>
                  </span>)}
                  <button type="button" onClick={() => {
                    setReportFilters({ startDate: '', endDate: '', status: '', role: '', category: '', actor: '', eventType: '', outcome: '' });
                    setDatePreset('all');
                    setReport(null);
                    setReportSnapshotId(null);
                    setReportError(null);
                  }} className="min-h-8 px-2 text-xs font-semibold text-cyan-800 underline underline-offset-2 dark:text-cyan-300">Clear filters</button>
                </>}
                <button type="button" onClick={resetReportConfiguration} className="min-h-8 px-2 text-xs font-semibold text-slate-600 underline underline-offset-2 dark:text-slate-300">Reset to defaults</button>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <button type="submit" disabled={reportLoading || exportLoading || selectedReportColumns.length === 0 || (reportFilters.startDate !== '' && reportFilters.endDate !== '' && reportFilters.endDate < reportFilters.startDate)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#10243c] px-4 text-sm font-semibold text-white hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-800 dark:hover:bg-cyan-700">
                  <RefreshCw className={`h-4 w-4 ${reportLoading ? 'animate-spin' : ''}`} aria-hidden="true" />{reportLoading ? 'Loading preview…' : 'Preview report'}
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400">Date range end dates are inclusive; database records use the configured database session timezone.</span>
              </div>
            </form>}
          </section>}

          {reportBuilderOpen && reportError && <p className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{reportError}</p>}
          {reportBuilderOpen && reportSuccess && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200" role="status">{reportSuccess}</p>}

          {reportBuilderOpen && reportStep === 3 && <section aria-labelledby="report-preview-title" className="space-y-4 rounded-xl border border-slate-200/80 bg-white/75 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/55 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div className="min-w-0"><h3 id="report-preview-title" className="text-sm font-bold text-slate-900 dark:text-white">Preview: {report?.title ?? selectedReportDefinition.label}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Selected format: {exportFormat.toUpperCase()}</p></div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => { setReportError(null); setReportStep(2); }} className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Back to configuration</button>
                <button type="button" onClick={() => void generateReport()} disabled={reportLoading || exportLoading} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <RefreshCw className={`h-3.5 w-3.5 ${reportLoading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh preview
                </button>
                <button type="button" onClick={() => void exportReport()} disabled={!reportSnapshotId || reportLoading || exportLoading} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {exportLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
                  {exportLoading ? 'Preparing…' : `Generate & Download ${exportFormat.toUpperCase()}`}
                </button>
              </div>
            </div>

            {reportLoading && !report && <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400" role="status">Loading report data…</p>}
            {!report && !reportLoading && <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-300">{reportError ? 'Preview could not be loaded. You can retry without losing your configuration.' : 'Preview data is not available yet.'}</p>
              <button type="button" onClick={() => void generateReport()} disabled={reportLoading} className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Retry preview</button>
            </div>}
            {report && <>
              <div className="grid gap-2 border-b border-slate-200 pb-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300 sm:grid-cols-2">
                <p><span className="font-semibold">Generated:</span> {new Date(report.generatedAt).toLocaleString()}</p>
                <p><span className="font-semibold">Reporting period:</span> {report.period.startDate ?? 'All dates'} to {report.period.endDate ?? 'All dates'}{report.period.endDateInclusive ? ' (inclusive)' : ''}</p>
                <p className="sm:col-span-2"><span className="font-semibold">Applied filters:</span> {Object.entries(report.filters).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(' · ') || 'None'}</p>
                <p className="sm:col-span-2"><span className="font-semibold">Records:</span> {report.includedRecords.toLocaleString()} included of {report.totalRecords.toLocaleString()} matching</p>
              </div>
              {report.truncated && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="status">Export limit reached: this report includes the first {report.includedRecords.toLocaleString()} records. Refine the filters to narrow the result.</p>}
              {report.rows.length > 25 && <p className="text-xs text-slate-500 dark:text-slate-400" role="status">Preview sample: first 25 of {report.includedRecords.toLocaleString()} included rows. The export contains all included rows.</p>}
              {report.summary.length > 0 && <section aria-labelledby="report-summary-title">
                <h4 id="report-summary-title" className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Summary</h4>
                <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {report.summary.map((metric) => <div key={metric.label} className="min-w-0 border-l-2 border-cyan-700 bg-slate-50 px-3 py-2 dark:border-cyan-400 dark:bg-slate-950/50"><dt className="truncate text-[10px] font-semibold text-slate-500 dark:text-slate-400">{metric.label}</dt><dd className="mt-1 break-words text-lg font-bold tabular-nums text-slate-900 dark:text-white">{typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}</dd></div>)}
                </dl>
              </section>}
              {report.notes.map((note) => <p key={note} className="text-xs leading-5 text-slate-500 dark:text-slate-400">{note}</p>)}
              {report.rows.length === 0 ? <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">No records match these filters. Exports will contain report metadata and an empty result set.</p> : <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400"><tr>{report.columns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-2.5 font-semibold">{column.label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {report.rows.slice(0, 25).map((row, index) => <tr key={index} className="align-top hover:bg-slate-50/70 dark:hover:bg-slate-950/40">
                      {report.columns.map((column) => {
                        const value = row[column.key];
                        const display = value === null || value === undefined || value === '' ? '—'
                          : column.type === 'date' ? new Date(String(value)).toLocaleString()
                            : column.type === 'number' && typeof value === 'number' ? value.toLocaleString()
                              : column.type === 'boolean' ? value ? 'Yes' : 'No' : String(value);
                        return <td key={column.key} className="max-w-[280px] px-3 py-2.5 text-slate-700 dark:text-slate-200"><span className="block max-h-24 overflow-y-auto whitespace-pre-wrap break-words" title={display}>{display}</span></td>;
                      })}
                    </tr>)}
                  </tbody>
                </table>
              </div>}
            </>}
          </section>}
        </section>
      )}

      {/* Administrator account settings */}
      {activeTab === 'settings' && (
        <section aria-labelledby="admin-settings-title" className="space-y-6">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white sm:p-8">
            <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border border-slate-300/60 dark:border-white/10" aria-hidden="true" />
            <div className="absolute -right-4 -top-8 h-40 w-40 rounded-full border border-slate-300/60 dark:border-white/10" aria-hidden="true" />
            <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-800 dark:border-cyan-200/20 dark:bg-white/10 dark:text-cyan-100">
                  <Settings className="h-3.5 w-3.5" aria-hidden="true" /> Account control center
                </span>
                <h3 id="admin-settings-title" className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Your account, your settings.</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-200">Keep your administrator profile current, review privacy preferences, and protect access to your account.</p>
              </div>
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-100/80 p-3 backdrop-blur-sm dark:border-white/15 dark:bg-white/10 sm:min-w-[260px]">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-200 text-sm font-bold text-slate-900 dark:border-white/20 dark:bg-white/15 dark:text-white">
                  {currentUser?.avatarUrl ? <img src={currentUser.avatarUrl} alt="" className="h-full w-full object-cover" /> : currentUser?.fullName?.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'A'}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{currentUser?.fullName || 'System Administrator'}</span>
                  <span className="mt-0.5 block truncate text-xs text-slate-600 dark:text-cyan-100/80">{currentUser?.email || 'Administrator account'}</span>
                  <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-300/15 dark:text-emerald-100">Administrator</span>
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-[#111d30] dark:hover:border-cyan-800">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200"><User className="h-5 w-5" aria-hidden="true" /></span>
              <h4 className="mt-4 text-base font-bold text-slate-950 dark:text-white">My profile</h4>
              <p className="mt-1 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-400">Update your personal information, contact details, and administrator profile.</p>
              <button type="button" onClick={() => onNavigate('account-profile')} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-cyan-900 transition-colors hover:bg-cyan-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:text-cyan-200 dark:hover:bg-cyan-950/50">Manage profile <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></button>
            </article>

            <article className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-[#111d30] dark:hover:border-cyan-800">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"><Lock className="h-5 w-5" aria-hidden="true" /></span>
              <h4 className="mt-4 text-base font-bold text-slate-950 dark:text-white">Password &amp; security</h4>
              <p className="mt-1 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-400">Change your password and maintain secure access to administrative tools.</p>
              <button type="button" onClick={() => onNavigate('account-security')} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-indigo-900 transition-colors hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 dark:text-indigo-200 dark:hover:bg-indigo-950/50">Review security <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></button>
            </article>

            <article className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md dark:border-slate-800 dark:bg-[#111d30] dark:hover:border-cyan-800">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200"><Settings className="h-5 w-5" aria-hidden="true" /></span>
              <h4 className="mt-4 text-base font-bold text-slate-950 dark:text-white">Privacy &amp; preferences</h4>
              <p className="mt-1 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-400">Control profile visibility and how your account information is shared across SKILLBRIDGE.</p>
              <button type="button" onClick={() => onNavigate('account-settings')} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-violet-900 transition-colors hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-600 dark:text-violet-200 dark:hover:bg-violet-950/50">Manage preferences <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></button>
            </article>

            <article className="flex flex-col justify-between rounded-xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-950 dark:bg-slate-900">
              <div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200"><LogOut className="h-5 w-5" aria-hidden="true" /></span>
                <h4 className="mt-4 text-base font-bold text-slate-950 dark:text-white">Sign out</h4>
                <p className="mt-1 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-400">End your administrator session on this device when you’re finished.</p>
              </div>
              <button type="button" onClick={() => { void logout(); onNavigate('auth'); }} className="mt-4 inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-800 transition-colors hover:border-rose-300 hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-600 dark:border-rose-900 dark:bg-slate-950/50 dark:text-rose-200 dark:hover:bg-rose-950/50">Sign out securely <LogOut className="h-4 w-4" aria-hidden="true" /></button>
            </article>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-cyan-200 bg-cyan-50/70 px-4 py-3 text-xs leading-5 text-cyan-950 dark:border-cyan-900/70 dark:bg-cyan-950/30 dark:text-cyan-100">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p><span className="font-bold">Administrator safety:</span> Profile and security changes use the protected account endpoints. Provider credentials remain server-side in the backend environment and are never managed or displayed in this browser settings page.</p>
          </div>
        </section>
      )}

      {selectedVer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl space-y-4 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  Record Verification Determination
                </h3>
                <p className="text-xs text-slate-500">For {selectedVer.companyName}</p>
              </div>
              <button type="button" onClick={() => setSelectedVer(null)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close verification review"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 sm:grid-cols-2">
              <div><strong>Account holder:</strong> {selectedVer.accountHolderName}</div>
              <div><strong>Registered email:</strong> {selectedVer.contactEmail}</div>
              <div><strong>Email status:</strong> {selectedVer.emailVerificationStatus === 'verified' ? 'Verified' : selectedVer.emailVerificationStatus === 'action_required' ? 'Action required' : 'Needs verification'}</div>
              <div><strong>Business status:</strong> {String(selectedVer.status).replaceAll('_', ' ')}</div>
              <div><strong>TIN:</strong> <code className="font-mono">{selectedVer.tinNumber || 'Not submitted'}</code></div>
              <div><strong>Business license:</strong> <code className="font-mono">{selectedVer.businessLicenseNo || 'Not submitted'}</code></div>
              <div><strong>Industry:</strong> {selectedVer.industry || 'Not provided'}</div>
              <div><strong>Location:</strong> {selectedVer.address || selectedVer.city || 'Not provided'}</div>
              <div><strong>Website:</strong> {selectedVer.website || 'Not provided'}</div>
              <div><strong>Submitted:</strong> {selectedVer.submittedAt ? new Date(selectedVer.submittedAt).toLocaleString() : 'Not submitted'}</div>
              <div><strong>Last review:</strong> {selectedVer.reviewedAt ? new Date(selectedVer.reviewedAt).toLocaleString() : 'No review recorded'}</div>
              <div><strong>Reviewer:</strong> {selectedVer.reviewerName || 'Not recorded'}</div>
              <div className="sm:col-span-2"><strong>Organization overview:</strong> {selectedVer.companyOverview || 'Not provided'}</div>
            </div>
            <section className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700" aria-labelledby="private-verification-documents-title">
              <div className="flex items-center justify-between gap-3">
                <h4 id="private-verification-documents-title" className="text-sm font-bold text-slate-900 dark:text-white">Private supporting documents</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400">{verificationDocuments.length} uploaded</span>
              </div>
              {verificationDetailsLoading && <p role="status" className="text-xs text-slate-500">Loading documents and review history…</p>}
              {verificationDetailsError && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{verificationDetailsError}</p>}
              {!verificationDetailsLoading && verificationDocuments.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">No private supporting documents have been uploaded for this employer.</p>}
              {verificationDocuments.map((document) => <VerificationDocumentReviewCard
                key={document.id}
                document={document}
                busy={documentActionLoadingId === document.id}
                onReview={reviewVerificationDocument}
                onPreview={(item) => { void previewVerificationDocument(item); }}
                onDownload={(item) => { void downloadVerificationDocument(item); }}
              />)}
            </section>
            <section className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700" aria-labelledby="verification-history-title">
              <h4 id="verification-history-title" className="text-sm font-bold text-slate-900 dark:text-white">Business review history</h4>
              {!verificationDetailsLoading && verificationHistory.length === 0 && <p className="text-xs text-slate-500 dark:text-slate-400">No previous business review decisions.</p>}
              {verificationHistory.map((history) => <article key={history.id} className="rounded-md bg-slate-50 p-2.5 text-xs dark:bg-slate-950">
                <p className="font-semibold text-slate-800 dark:text-slate-200">{history.status.replaceAll('_', ' ')} · Submitted {new Date(history.submittedAt).toLocaleString()}</p>
                <p className="mt-1 text-slate-500 dark:text-slate-400">Reviewed by {history.reviewerName || 'Not recorded'}{history.reviewedAt ? ` · ${new Date(history.reviewedAt).toLocaleString()}` : ''}</p>
                {history.reviewNotes && <p className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300">{history.reviewNotes}</p>}
              </article>)}
            </section>
            <div className="flex flex-wrap gap-2">
              {selectedVer.emailVerificationStatus === 'unverified' && <button type="button" disabled={resendingVerificationUserId === selectedVer.userId} onClick={() => void resendEmployerVerificationEmail(selectedVer)} className="min-h-9 rounded-md border border-cyan-700 px-3 text-xs font-semibold text-cyan-900 disabled:opacity-50 dark:border-cyan-600 dark:text-cyan-200">{resendingVerificationUserId === selectedVer.userId ? 'Sending…' : 'Resend verification email'}</button>}
              {selectedVer.emailVerificationStatus === 'unverified' && <button type="button" onClick={() => { setSelectedEmailVerification({ userId: selectedVer.userId, email: selectedVer.contactEmail, fullName: selectedVer.accountHolderName }); setEmailVerificationReason(''); setEmailVerificationAcknowledged(false); }} className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Manually verify email</button>}
            </div>

            <form onSubmit={handleConfirmDecision} className="space-y-3.5 text-xs">
              <label htmlFor="verification-decision" className="block font-semibold text-slate-700 dark:text-slate-200">
                Review outcome
                <select id="verification-decision" value={decisionAction} onChange={(event) => setDecisionAction(event.target.value as typeof decisionAction)} className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                  <option value="APPROVED">Approve internally</option>
                  <option value="REJECTED">Reject</option>
                  <option value="RESUBMISSION_REQUIRED">Request resubmission</option>
                </select>
              </label>
              <div>
                <label htmlFor="verification-review-notes" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Review notes / reason
                </label>
                <textarea
                  id="verification-review-notes"
                  rows={3}
                  required
                  maxLength={1000}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100">
                Approval requires verified email, complete TIN/license fields, and approval of every uploaded document. This is internal SKILLBRIDGE review, not government registry verification. Email confirmation never approves the business.
              </div>
              {selectedVer.emailVerificationStatus !== 'verified' && decisionAction === 'APPROVED' && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-2.5 text-[11px] text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{selectedVer.emailVerificationStatus === 'action_required' ? 'Business approval is blocked until the conflicting email-verification evidence is reviewed.' : 'Business approval is unavailable until the account email is verified.'}</p>}
              {decisionAction === 'APPROVED' && verificationDocuments.some((document) => document.status !== 'APPROVED') && <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Review every uploaded document before approving the business.</p>}
              <label className="flex items-start gap-2 text-xs leading-5 text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={decisionAcknowledged} onChange={(event) => setDecisionAcknowledged(event.target.checked)} className="mt-1" />
                <span>I confirm this decision is based on the submitted information and the stated review requirements.</span>
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setSelectedVer(null)} className="min-h-10 rounded-md px-4 font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={decisionLoading || !decisionAcknowledged || (decisionAction === 'APPROVED' && (selectedVer.emailVerificationStatus !== 'verified' || verificationDetailsLoading || Boolean(verificationDetailsError) || verificationDocuments.some((document) => document.status !== 'APPROVED')))}
                  className="min-h-10 rounded-md bg-slate-900 px-5 font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-cyan-800 dark:hover:bg-cyan-700"
                >
                  {decisionLoading ? 'Recording…' : 'Record decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {documentPreview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="verification-document-preview-title" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 id="verification-document-preview-title" className="truncate text-sm font-bold text-slate-950 dark:text-white">{documentPreview.filename}</h2>
              <button type="button" onClick={() => setDocumentPreview(null)} className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-semibold dark:border-slate-700">Close preview</button>
            </div>
            {documentPreview.contentType === 'application/pdf'
              ? <iframe title={`Preview of ${documentPreview.filename}`} src={documentPreview.url} sandbox="allow-same-origin" className="min-h-[60vh] flex-1 rounded-md border border-slate-200 dark:border-slate-700" />
              : <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-md bg-slate-100 p-2 dark:bg-slate-950"><img src={documentPreview.url} alt={`Preview of ${documentPreview.filename}`} className="max-h-[70vh] max-w-full object-contain" /></div>}
          </section>
        </div>
      )}

      {selectedEmailVerification && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="manual-email-verification-title" className="w-full max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">Audited email verification</p>
              <h2 id="manual-email-verification-title" className="mt-1 text-lg font-bold text-slate-950 dark:text-white">Verify this account email after review?</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{selectedEmailVerification.fullName} · {selectedEmailVerification.email}</p>
            </div>
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
              {selectedEmailVerification.reviewStatus === 'action_required'
                ? 'Review the account and available verification history before proceeding. Confirm the email is genuinely verified; your reason and administrator identity will be recorded. This does not change account active status or approve an employer business.'
                : 'Prefer sending an OTP whenever mailbox ownership can be established. This administrative exception requires a valid reason and does not change account active status or approve an employer business.'}
            </p>
            {actionError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{actionError}</p>}
            <form onSubmit={handleManualEmployerEmailVerification} className="space-y-4">
              <label htmlFor="manual-email-verification-reason" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                Required reason for this exception
                <textarea id="manual-email-verification-reason" required minLength={3} maxLength={500} rows={3} value={emailVerificationReason} onChange={(event) => setEmailVerificationReason(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <label className="flex items-start gap-2 text-xs leading-5 text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={emailVerificationAcknowledged} onChange={(event) => setEmailVerificationAcknowledged(event.target.checked)} className="mt-1" />
                <span>I confirm this verification decision is justified after reviewing available evidence and understand this action does not activate the account or approve an employer's business.</span>
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <button type="button" disabled={emailVerificationLoading} onClick={() => setSelectedEmailVerification(null)} className="min-h-10 rounded-md px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={emailVerificationLoading || !emailVerificationAcknowledged || emailVerificationReason.trim().length < 3} className="min-h-10 rounded-md bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50">{emailVerificationLoading ? 'Recording…' : 'Confirm and verify email'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !moderationLoading) setSelectedUser(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="moderation-dialog-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Account moderation</p>
              <h2 id="moderation-dialog-title" className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                {selectedUser.isActive ? 'Suspend this account?' : 'Reactivate this account?'}
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{selectedUser.fullName} · {selectedUser.email}</p>
            </div>

            {actionError && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200" role="alert">{actionError}</p>}

            <form onSubmit={handleConfirmModeration} className="space-y-4">
              <label htmlFor="moderation-reason" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                Reason for this action
                <textarea id="moderation-reason" required minLength={3} maxLength={500} rows={4} value={moderationReason} onChange={(event) => setModerationReason(event.target.value)} className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white p-3 text-sm font-normal text-slate-950 focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </label>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button type="button" disabled={moderationLoading} onClick={() => setSelectedUser(null)} className="min-h-10 rounded-md px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                <button type="submit" disabled={moderationLoading || moderationReason.trim().length < 3} className={`min-h-10 rounded-md px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${selectedUser.isActive ? 'bg-rose-700 hover:bg-rose-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}>
                  {moderationLoading ? 'Saving…' : selectedUser.isActive ? 'Confirm suspension' : 'Confirm reactivation'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedUserDetails && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) { userDetailsRequestRef.current += 1; setSelectedUserDetails(null); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="user-details-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">Account detail</p><h2 id="user-details-title" className="mt-1 truncate text-lg font-bold text-slate-950 dark:text-white">{selectedUserDetails.fullName}</h2><p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">{selectedUserDetails.email}</p></div>
            <button type="button" onClick={() => { userDetailsRequestRef.current += 1; setSelectedUserDetails(null); }} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close user details"><X className="h-4 w-4" /></button>
          </div>
          <dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {[
              ['Phone', selectedUserDetails.phone || 'Not provided'],
              ['Role', String(selectedUserDetails.role).replaceAll('_', ' ')],
              ['Email verification', selectedUserDetails.emailVerificationStatus === 'verified' ? 'Verified' : selectedUserDetails.emailVerificationStatus === 'action_required' ? 'Action required — records need review' : 'Needs verification'],
              ['Verification method', selectedUserDetails.emailVerificationMethod || 'Not recorded'],
              ['Verified at', selectedUserDetails.emailVerifiedAt ? new Date(selectedUserDetails.emailVerifiedAt).toLocaleString() : userVerificationChallenge?.verifiedAt ? new Date(userVerificationChallenge.verifiedAt).toLocaleString() : 'Not recorded'],
              ['Account status', String(selectedUserDetails.accountStatus ?? (selectedUserDetails.isActive ? 'active' : 'suspended')).replaceAll('_', ' ')],
              ['Created', new Date(selectedUserDetails.createdAt).toLocaleString()],
              ['Account ID', selectedUserDetails.id],
            ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100">{value}</dd></div>)}
          </dl>
          {userDetailsLoading && <p className="mt-4 text-sm text-slate-500" role="status">Loading verification history…</p>}
          {userDetailsError && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{userDetailsError}</p>}
          {selectedUserDetails.emailVerificationStatus === 'action_required' && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Verification records are missing or inconsistent. Review the available history and confirm email ownership before using the audited administrator verification action.</p>}
          {selectedUserDetails.emailVerificationStatus === 'unverified' && <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={resendingVerificationUserId === selectedUserDetails.id || userDetailsLoading} onClick={() => void resendUserVerificationEmail(selectedUserDetails)} className="min-h-9 rounded-lg border border-cyan-700 px-3 text-xs font-semibold text-cyan-900 disabled:opacity-50 dark:border-cyan-600 dark:text-cyan-200">{resendingVerificationUserId === selectedUserDetails.id ? 'Sending OTP…' : 'Resend verification OTP'}</button>
            {selectedUserDetails.role !== 'ADMIN' && selectedUserDetails.id !== currentUser?.id && <button type="button" onClick={() => { setSelectedEmailVerification({ userId: selectedUserDetails.id, email: selectedUserDetails.email, fullName: selectedUserDetails.fullName }); setEmailVerificationReason(''); setEmailVerificationAcknowledged(false); }} className="min-h-9 rounded-lg border border-amber-600 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-200 dark:hover:bg-amber-950/40">Verify email (audited exception)</button>}
          </div>}
          {selectedUserDetails.emailVerificationStatus === 'action_required' && selectedUserDetails.role !== 'ADMIN' && selectedUserDetails.id !== currentUser?.id && <div className="mt-4">
            <button type="button" disabled={userDetailsLoading} onClick={() => { setSelectedEmailVerification({ userId: selectedUserDetails.id, email: selectedUserDetails.email, fullName: selectedUserDetails.fullName, reviewStatus: 'action_required' }); setEmailVerificationReason(''); setEmailVerificationAcknowledged(false); }} className="min-h-9 rounded-lg border border-amber-600 px-3 text-xs font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-500 dark:text-amber-200">Verify email after review</button>
          </div>}
          {userVerificationChallenge && <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Most recent OTP activity</h3>
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
              <div><dt className="font-semibold text-slate-500">Request created</dt><dd className="mt-1 text-slate-800 dark:text-slate-200">{new Date(userVerificationChallenge.createdAt).toLocaleString()}</dd></div>
              <div><dt className="font-semibold text-slate-500">Last sent</dt><dd className="mt-1 text-slate-800 dark:text-slate-200">{new Date(userVerificationChallenge.lastSentAt).toLocaleString()}</dd></div>
              <div><dt className="font-semibold text-slate-500">Code expires</dt><dd className="mt-1 text-slate-800 dark:text-slate-200">{new Date(userVerificationChallenge.expiresAt).toLocaleString()}</dd></div>
              <div><dt className="font-semibold text-slate-500">Failed attempts</dt><dd className="mt-1 text-slate-800 dark:text-slate-200">{userVerificationChallenge.failedAttempts}</dd></div>
            </dl>
          </section>}
          <section className="mt-5 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Account and verification history</h3>
            {!userDetailsLoading && userVerificationHistory.length === 0 && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">No additional account history is recorded.</p>}
            {userVerificationHistory.map((event) => <article key={event.id} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
              <p className="font-semibold text-slate-800 dark:text-slate-200">{String(event.action).replaceAll('_', ' ')} · {new Date(event.createdAt).toLocaleString()}</p>
              <p className="mt-1 text-slate-500 dark:text-slate-400">By {event.actorName || 'Administrator'}{event.reason ? ` · Reason: ${event.reason}` : ''}</p>
            </article>)}
          </section>
          <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <div>
              {selectedUserDetails.id !== currentUser?.id && selectedUserDetails.accountStatus !== 'pending_verification' && <button type="button" onClick={() => { setSelectedUser(selectedUserDetails); setModerationReason(''); setActionError(null); userDetailsRequestRef.current += 1; setSelectedUserDetails(null); }} className={`min-h-10 rounded-md px-4 text-sm font-semibold ${selectedUserDetails.isActive ? 'border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300' : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300'}`}>{selectedUserDetails.isActive ? 'Suspend account' : 'Reactivate account'}</button>}
            </div>
            <button type="button" onClick={() => { userDetailsRequestRef.current += 1; setSelectedUserDetails(null); }} className="min-h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Close</button>
          </div>
        </section>
      </div>}

      {selectedJobDetails && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedJobDetails(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="admin-job-details-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">Job details</p><h2 id="admin-job-details-title" className="mt-1 break-words text-lg font-bold text-slate-950 dark:text-white">{selectedJobDetails.title}</h2></div>
            <button type="button" onClick={() => setSelectedJobDetails(null)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close job details"><X className="h-4 w-4" /></button>
          </div>
          <dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {[
              ['Employer', selectedJobDetails.companyName],
              ['Employer status', selectedJobDetails.employerApproved ? 'Approved' : 'Not approved'],
              ['Summary', selectedJobDetails.summary || 'No job summary'],
              ['Job status', selectedJobDetails.isExpired ? 'Expired' : selectedJobDetails.status],
              ['Deadline', selectedJobDetails.deadline ? new Date(selectedJobDetails.deadline).toLocaleString() : 'No deadline'],
              ['Applicants', Number(selectedJobDetails.applicantsCount ?? 0).toLocaleString()],
              ['Created', new Date(selectedJobDetails.createdAt).toLocaleString()],
              ['Job ID', selectedJobDetails.id],
            ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100">{value}</dd></div>)}
          </dl>
          <div className="mt-5 flex justify-end border-t border-slate-200 pt-4 dark:border-slate-800"><button type="button" onClick={() => setSelectedJobDetails(null)} className="min-h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Close</button></div>
        </section>
      </div>}

      {selectedAdminJob && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !adminJobModerationLoading) setSelectedAdminJob(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="admin-job-moderation-title" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-5 overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Job moderation</p>
            <h2 id="admin-job-moderation-title" className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Change job status?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{selectedAdminJob.title} · {selectedAdminJob.companyName}</p>
          </div>
          {actionError && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200" role="alert">{actionError}</p>}
          <form onSubmit={handleConfirmAdminJobModeration} className="space-y-4">
            <label htmlFor="admin-job-status" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">New status
              <select id="admin-job-status" value={adminJobStatus} onChange={(event) => setAdminJobStatus(event.target.value as typeof adminJobStatus)} className="mt-1.5 block min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="CLOSED">Closed</option>
              </select>
            </label>
            <label htmlFor="admin-job-moderation-reason" className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Reason for this action
              <textarea id="admin-job-moderation-reason" required minLength={3} maxLength={500} rows={4} value={adminJobReason} onChange={(event) => setAdminJobReason(event.target.value)} className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white p-3 text-sm font-normal text-slate-950 focus:border-cyan-700 focus:outline-none focus:ring-4 focus:ring-cyan-700/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </label>
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button type="button" disabled={adminJobModerationLoading} onClick={() => setSelectedAdminJob(null)} className="min-h-10 rounded-md px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={adminJobModerationLoading || adminJobReason.trim().length < 3} className="min-h-10 rounded-md bg-amber-700 px-4 text-sm font-semibold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50">{adminJobModerationLoading ? 'Saving…' : 'Confirm status change'}</button>
            </div>
          </form>
        </section>
      </div>}

        </main>
      </div>
      <footer className="border-t border-slate-200 px-4 py-3 text-center text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        © 2026 SKILLBRIDGE ET · Admin Portal
      </footer>
    </div>
  );
};
