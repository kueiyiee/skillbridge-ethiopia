import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Clock,
  FileText,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthContext';
import { api } from '@/src/services/api-client';
import type { EmployerVerificationDocument } from '@/src/services/api-client';
import { EmployerMessagesPanel } from '../components/EmployerMessagesPanel';
import { CandidateDiscoveryPage } from '../components/CandidateDiscoveryPage';
import { EmployerReportsPage } from '../components/EmployerReportsPage';
import { DashboardMetricCard, DashboardPageHeader } from '@/src/components/shared/DashboardPrimitives';
import type { Application, ApplicationStatus, EmployerProfile, Job, Skill, SkillLevel } from '@/shared/types';

interface EmployerDashboardProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

interface EmployerWorkspace extends EmployerProfile {
  jobs: Job[];
  verification: { status: string; reviewNotes?: string | null; createdAt?: string } | null;
}

interface EmployerAnalytics {
  summary: {
    totalJobsPublished: number;
    activeJobsCount: number;
    draftJobsCount?: number;
    pausedJobsCount: number;
    closedJobsCount: number;
    expiredJobsCount?: number;
    totalApplications: number;
    reviewedApplications: number;
    responseRate: number;
    avgResponseTimeDisplay: string;
    avgMatchScore: number;
    confirmedOffersCount: number;
    interviewsScheduledCount?: number;
    candidateSkillCoveragePct: number;
    totalUniqueSkillsRequired: number;
    skillsCoveredByApplicants: number;
  };
  statusDistribution: Record<ApplicationStatus, number>;
  sampleSizeContext: string;
  dataNotice: string;
  definitions: Record<string, string>;
}

type Section = 'overview' | 'organization' | 'jobs' | 'applications' | 'analytics' | 'discovery' | 'interviews' | 'reports' | 'messages';
type AnalyticsRange = '7' | '30' | '90' | 'all';

interface ActivityPoint {
  key: string;
  label: string;
  fullLabel: string;
  count: number;
}

const sections: Array<{ id: Section; label: string; group: string; icon: typeof Building2; available: boolean }> = [
  { id: 'overview', label: 'Overview', group: 'Workspace', icon: Activity, available: true },
  { id: 'organization', label: 'Organization Profile', group: 'Workspace', icon: Building2, available: true },
  { id: 'jobs', label: 'Job Management', group: 'Workspace', icon: Briefcase, available: true },
  { id: 'applications', label: 'Applications', group: 'Workspace', icon: Users, available: true },
  { id: 'discovery', label: 'Candidate Discovery', group: 'Workspace', icon: Search, available: true },
  { id: 'interviews', label: 'Interviews & Shortlisting', group: 'Workspace', icon: Clock, available: true },
  { id: 'analytics', label: 'Recruitment Analytics', group: 'Insights', icon: BarChart3, available: true },
  { id: 'reports', label: 'Reports & Exports', group: 'Insights', icon: FileText, available: true },
  { id: 'messages', label: 'Messages & Notifications', group: 'Communication', icon: Mail, available: true },
];

const applicationStatuses: ApplicationStatus[] = [
  'APPLIED',
  'SCREENING',
  'SHORTLISTED',
  'TECHNICAL_ASSESSMENT',
  'INTERVIEW_SCHEDULED',
  'OFFERED',
  'HIRED',
  'REJECTED',
  'WITHDRAWN',
];

const statusLabels: Record<ApplicationStatus, string> = {
  APPLIED: 'New',
  SCREENING: 'Screening',
  SHORTLISTED: 'Shortlisted',
  TECHNICAL_ASSESSMENT: 'Assessment',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  OFFERED: 'Offer made',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

const nextApplicationStatuses: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  APPLIED: ['SCREENING', 'SHORTLISTED', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'REJECTED'],
  SCREENING: ['SHORTLISTED', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'REJECTED'],
  SHORTLISTED: ['TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED'],
  TECHNICAL_ASSESSMENT: ['INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED'],
  INTERVIEW_SCHEDULED: ['OFFERED', 'REJECTED'],
  OFFERED: ['HIRED', 'REJECTED'],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const applicationStageTemplates: Partial<Record<ApplicationStatus, { label: string; note: string }>> = {
  SCREENING: { label: 'Application under review', note: 'Thank you for your application. Our team is reviewing it and will share another update when we have next steps.' },
  SHORTLISTED: { label: 'Shortlisting notification', note: 'We are pleased to let you know that you have been shortlisted. We will contact you with the next steps.' },
  TECHNICAL_ASSESSMENT: { label: 'Assessment request', note: 'Your application is moving to the assessment stage. We will send the assessment details and any relevant deadline separately.' },
  INTERVIEW_SCHEDULED: { label: 'Interview stage update', note: 'We would like to continue your application in the interview stage. We will send the interview details separately.' },
  OFFERED: { label: 'Offer notification', note: 'We are pleased to share an offer update. Our team will contact you with the details.' },
  HIRED: { label: 'Hiring confirmation', note: 'We are pleased to confirm your successful hiring for this role. Our team will follow up with next steps.' },
  REJECTED: { label: 'Polite rejection', note: 'Thank you for your interest and the time you invested in applying. We will not be moving forward with your application at this time, and we wish you success in your search.' },
};

const controlClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-600/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const primaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#10243c] px-4 text-sm font-semibold text-white transition hover:bg-cyan-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-800 dark:hover:bg-cyan-700';

function emptyJobDraft(): {
  title: string;
  department: string;
  jobType: Job['jobType'];
  city: string;
  workplaceType: string;
  summary: string;
  responsibilities: string;
  qualifications: string;
  minExperienceYears: string;
  salaryMinETB: string;
  salaryMaxETB: string;
  deadline: string;
  skillRequirements: Array<{ skillId: string; requiredLevel: SkillLevel }>;
} {
  return {
    title: '',
    department: '',
    jobType: 'FULL_TIME',
    city: '',
    workplaceType: 'On-site',
    summary: '',
    responsibilities: '',
    qualifications: '',
    minExperienceYears: '0',
    salaryMinETB: '',
    salaryMaxETB: '',
    deadline: '',
    skillRequirements: [{ skillId: '', requiredLevel: 'INTERMEDIATE' }],
  };
}

function readableStatus(status: string): string {
  return status.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value?: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Not recorded' : date.toLocaleDateString();
}

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildActivityPoints(applications: Application[], range: AnalyticsRange, now = new Date()): ActivityPoint[] {
  const validApplications = applications.flatMap((application) => {
    const appliedAt = new Date(application.appliedAt);
    return Number.isNaN(appliedAt.valueOf()) || appliedAt > now ? [] : [{ ...application, appliedAt }];
  });
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === 'all') {
    const earliest = validApplications.reduce((minimum, application) =>
      application.appliedAt < minimum ? application.appliedAt : minimum, start);
    start.setTime(earliest.getTime());
    start.setDate(1);
    const months: ActivityPoint[] = [];
    const cursor = new Date(start);
    while (cursor <= now) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        key,
        label: cursor.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        fullLabel: cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        count: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    const indexByKey = new Map(months.map((point, index) => [point.key, index]));
    for (const application of validApplications) {
      const key = `${application.appliedAt.getFullYear()}-${String(application.appliedAt.getMonth() + 1).padStart(2, '0')}`;
      const index = indexByKey.get(key);
      if (index !== undefined) months[index].count += 1;
    }
    return months;
  }

  const days = Number(range);
  start.setDate(start.getDate() - (days - 1));
  if (days === 90) {
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weeks: ActivityPoint[] = [];
    const cursor = new Date(weekStart);
    while (cursor <= now) {
      weeks.push({
        key: localDateKey(cursor),
        label: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        fullLabel: `Week of ${cursor.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`,
        count: 0,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    const indexByKey = new Map(weeks.map((point, index) => [point.key, index]));
    for (const application of validApplications) {
      if (application.appliedAt < start || application.appliedAt > now) continue;
      const week = new Date(application.appliedAt);
      week.setDate(week.getDate() - ((week.getDay() + 6) % 7));
      const index = indexByKey.get(localDateKey(week));
      if (index !== undefined) weeks[index].count += 1;
    }
    return weeks;
  }

  const points: ActivityPoint[] = [];
  const cursor = new Date(start);
  while (cursor <= now) {
    const key = localDateKey(cursor);
    points.push({
      key,
      label: cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      fullLabel: cursor.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      count: 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  const indexByKey = new Map(points.map((point, index) => [point.key, index]));
  for (const application of validApplications) {
    if (application.appliedAt < start || application.appliedAt > now) continue;
    const index = indexByKey.get(localDateKey(application.appliedAt));
    if (index !== undefined) points[index].count += 1;
  }
  return points;
}

function ApplicationActivityChart({ points }: { points: ActivityPoint[] }) {
  const width = 720;
  const height = 240;
  const left = 36;
  const right = 16;
  const top = 18;
  const bottom = 42;
  const maxCount = Math.max(1, ...points.map(({ count }) => count));
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: left + (points.length <= 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: top + chartHeight - (point.count / maxCount) * chartHeight,
  }));
  const polyline = coordinates.map(({ x, y }) => `${x},${y}`).join(' ');
  const axisIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), Math.max(0, points.length - 1)])];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 w-full overflow-visible" role="img" aria-label="Application submissions over the selected time range">
      <title>Application Activity</title>
      {[0, 0.5, 1].map((fraction) => {
        const y = top + chartHeight * fraction;
        const value = Math.round(maxCount * (1 - fraction));
        return <g key={fraction}><line x1={left} x2={width - right} y1={y} y2={y} className="stroke-slate-200 dark:stroke-slate-700" strokeDasharray="3 5" /><text x={left - 9} y={y + 4} textAnchor="end" className="fill-slate-500 dark:fill-slate-400" fontSize="11">{value}</text></g>;
      })}
      {coordinates.length > 1 && <polyline points={polyline} fill="none" stroke="currentColor" className="text-slate-800 dark:text-slate-100" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
      {coordinates.map((point) => (
        <circle key={point.key} cx={point.x} cy={point.y} r="4" className="fill-white stroke-slate-800 dark:fill-slate-900 dark:stroke-slate-100" strokeWidth="2">
          <title>{`${point.fullLabel}: ${point.count} ${point.count === 1 ? 'application' : 'applications'}`}</title>
        </circle>
      ))}
      {axisIndexes.map((index) => {
        const point = coordinates[index];
        return point ? <text key={point.key} x={point.x} y={height - 12} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} className="fill-slate-500 dark:fill-slate-400" fontSize="11">{point.label}</text> : null;
      })}
    </svg>
  );
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('The selected document could not be read.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('The selected document could not be read.'));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

function EmptyState({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">{detail}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const EmployerDashboard: React.FC<EmployerDashboardProps> = ({ onNavigate }) => {
  const { user, employerProfile: authEmployer, refreshEmployer } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSection = searchParams.get('section') as Section | null;
  const activeSection = sections.some((item) => item.id === requestedSection) ? requestedSection! : 'overview';
  const currentItem = sections.find((item) => item.id === activeSection)!;
  const [workspace, setWorkspace] = useState<EmployerWorkspace | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [analytics, setAnalytics] = useState<EmployerAnalytics | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number | null>(null);
  const [verificationDocuments, setVerificationDocuments] = useState<EmployerVerificationDocument[]>([]);
  const [verificationDocumentsError, setVerificationDocumentsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<AnalyticsRange>('30');
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('skillbridge_employer_sidebar_collapsed') === 'true');
  const [jobQuery, setJobQuery] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('');
  const [applicationQuery, setApplicationQuery] = useState('');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('');
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);
  const [busyApplication, setBusyApplication] = useState<string | null>(null);
  const [busyJob, setBusyJob] = useState<string | null>(null);
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    application: Application;
    status: ApplicationStatus;
    note: string;
  } | null>(null);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [jobSaving, setJobSaving] = useState(false);
  const [jobAiDrafting, setJobAiDrafting] = useState(false);
  const [jobAiAdvice, setJobAiAdvice] = useState<string | null>(null);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentCategory, setDocumentCategory] = useState<EmployerVerificationDocument['category']>('BUSINESS_REGISTRATION');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [tinNumber, setTinNumber] = useState('');
  const [businessLicenseNo, setBusinessLicenseNo] = useState('');
  const [jobDraft, setJobDraft] = useState(emptyJobDraft);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setApplicationsError(null);
    setAnalyticsError(null);
    setSkillsError(null);
    const [workspaceResult, skillsResult, documentsResult] = await Promise.allSettled([
      api.getEmployerMe(),
      api.getSkills(),
      api.getEmployerVerificationDocuments(),
    ]);
    if (workspaceResult.status === 'fulfilled') {
      setWorkspace(workspaceResult.value as EmployerWorkspace);
      setTinNumber(workspaceResult.value.tinNumber || '');
      setBusinessLicenseNo(workspaceResult.value.businessLicenseNo || '');
    } else {
      setLoadError(workspaceResult.reason instanceof Error ? workspaceResult.reason.message : 'Your organization workspace could not be loaded.');
    }
    if (skillsResult.status === 'fulfilled') setSkills(skillsResult.value);
    else setSkillsError(skillsResult.reason instanceof Error ? skillsResult.reason.message : 'The skill catalog could not be loaded.');
    if (documentsResult.status === 'fulfilled') {
      setVerificationDocuments(documentsResult.value);
      setVerificationDocumentsError(null);
    } else {
      setVerificationDocumentsError(documentsResult.reason instanceof Error ? documentsResult.reason.message : 'Verification documents could not be loaded.');
    }
    if (workspaceResult.status === 'fulfilled' && workspaceResult.value.isApproved) {
      const [applicationResult, analyticsResult, messagesResult] = await Promise.allSettled([
        api.getEmployerApplications(),
        api.getEmployerAnalytics(),
        api.getEmployerMessageThreads(),
      ]);
      if (applicationResult.status === 'fulfilled') setApplications(applicationResult.value);
      else setApplicationsError(applicationResult.reason instanceof Error ? applicationResult.reason.message : 'Applications could not be loaded.');
      if (analyticsResult.status === 'fulfilled') setAnalytics(analyticsResult.value);
      else setAnalyticsError(analyticsResult.reason instanceof Error ? analyticsResult.reason.message : 'Recruitment analytics could not be loaded.');
      if (messagesResult.status === 'fulfilled') setUnreadMessageCount(messagesResult.value.unreadCount);
      else setUnreadMessageCount(null);
    } else {
      setApplications([]);
      setAnalytics(null);
      setUnreadMessageCount(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => {
    localStorage.setItem('skillbridge_employer_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const jobs = workspace?.jobs ?? [];
  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const matchesQuery = `${job.title} ${job.department} ${job.city}`.toLowerCase().includes(jobQuery.toLowerCase());
    const effectiveStatus = job.effectiveStatus || job.status;
    return matchesQuery && (!jobStatusFilter || jobStatusFilter === effectiveStatus);
  }), [jobs, jobQuery, jobStatusFilter]);

  const filteredApplications = useMemo(() => applications.filter((application) => {
    const matchesQuery = `${application.candidateName} ${application.jobTitle} ${application.candidateHeadline || ''}`.toLowerCase().includes(applicationQuery.toLowerCase());
    return matchesQuery && (!applicationStatusFilter || application.status === applicationStatusFilter);
  }), [applications, applicationQuery, applicationStatusFilter]);

  const selectSection = (section: Section) => {
    setSearchParams(section === 'overview' ? {} : { section });
    setMessage(null);
  };

  const messageSelectedApplications = (applicationIds: string[]) => {
    const params: Record<string, string> = applicationIds.length === 1
      ? { section: 'messages', applicationId: applicationIds[0] }
      : { section: 'messages', applicationIds: applicationIds.join(',') };
    setSearchParams({
      ...params,
    });
    setMessage(null);
  };

  const refreshAfterChange = async () => {
    await loadData();
    await refreshEmployer();
  };

  const updateApplicationStatus = async (application: Application, nextStatus: ApplicationStatus, statusNote: string) => {
    if (application.status === nextStatus) return;
    setBusyApplication(application.id);
    setMessage(null);
    try {
      await api.updateApplicationStage(application.id, nextStatus, statusNote.trim());
      setMessage({ kind: 'success', text: `Application moved to ${statusLabels[nextStatus]}.` });
      setPendingStatusChange(null);
      await refreshAfterChange();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'The application status could not be updated.' });
    } finally {
      setBusyApplication(null);
    }
  };

  const requestApplicationStatus = (application: Application, nextStatus: ApplicationStatus) => {
    const template = applicationStageTemplates[nextStatus];
    setPendingStatusChange({
      application,
      status: nextStatus,
      note: template?.note || `Your application for ${application.jobTitle} is now ${statusLabels[nextStatus].toLowerCase()}.`,
    });
  };

  const updateJobStatus = async (job: Job, nextStatus: 'ACTIVE' | 'PAUSED' | 'CLOSED') => {
    const action = nextStatus === 'CLOSED' ? 'close' : nextStatus === 'PAUSED' ? 'pause' : 'reopen';
    const notificationCount = nextStatus === 'ACTIVE' ? 0 : applications.filter((application) =>
      application.jobId === job.id && !['REJECTED', 'WITHDRAWN', 'HIRED'].includes(application.status),
    ).length;
    const confirmation = notificationCount > 0
      ? `${action.charAt(0).toUpperCase()}${action.slice(1)} “${job.title}”? A private ${nextStatus === 'CLOSED' ? 'closure' : 'pause'} update will be sent to ${notificationCount} active applicant${notificationCount === 1 ? '' : 's'}.`
      : `${action.charAt(0).toUpperCase()}${action.slice(1)} “${job.title}”?`;
    if (!window.confirm(confirmation)) return;
    setBusyJob(job.id);
    setMessage(null);
    try {
      await api.updateJobStatus(job.id, nextStatus);
      setMessage({ kind: 'success', text: `“${job.title}” is now ${readableStatus(nextStatus).toLowerCase()}.` });
      await refreshAfterChange();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'The job status could not be updated.' });
    } finally {
      setBusyJob(null);
    }
  };

  const submitVerification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setVerificationSaving(true);
    setMessage(null);
    try {
      await api.submitVerification(tinNumber.trim(), businessLicenseNo.trim());
      setMessage({ kind: 'success', text: 'Your business details were submitted for administrator review.' });
      await refreshAfterChange();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Verification could not be submitted.' });
    } finally {
      setVerificationSaving(false);
    }
  };

  const submitVerificationDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!documentFile) {
      setMessage({ kind: 'error', text: 'Choose a document to upload.' });
      return;
    }
    if (documentFile.size > 4 * 1024 * 1024) {
      setMessage({ kind: 'error', text: 'Verification documents must be 4 MB or smaller.' });
      return;
    }
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(documentFile.type)) {
      setMessage({ kind: 'error', text: 'Choose a PDF, JPG, or PNG document.' });
      return;
    }
    setDocumentSaving(true);
    setMessage(null);
    try {
      await api.uploadEmployerVerificationDocument({
        category: documentCategory,
        originalFilename: documentFile.name,
        contentType: documentFile.type,
        data: await fileAsBase64(documentFile),
      });
      setDocumentFile(null);
      form.reset();
      setDocumentCategory('BUSINESS_REGISTRATION');
      setMessage({ kind: 'success', text: 'Your private verification document was uploaded for administrator review.' });
      await refreshAfterChange();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'The verification document could not be uploaded.' });
    } finally {
      setDocumentSaving(false);
    }
  };

  const openCreateJobForm = () => {
    setEditingJobId(null);
    setJobDraft(emptyJobDraft());
    setJobAiAdvice(null);
    setShowJobForm(true);
  };

  const openEditJobForm = (job: Job) => {
    setEditingJobId(job.id);
    setJobAiAdvice(null);
    setJobDraft({
      title: job.title,
      department: job.department || '',
      jobType: job.jobType,
      city: job.city || '',
      workplaceType: job.workplaceType || 'On-site',
      summary: job.summary || '',
      responsibilities: job.responsibilities.join('\n'),
      qualifications: job.qualifications.join('\n'),
      minExperienceYears: String(job.minExperienceYears ?? 0),
      salaryMinETB: job.salaryMinETB == null ? '' : String(job.salaryMinETB),
      salaryMaxETB: job.salaryMaxETB == null ? '' : String(job.salaryMaxETB),
      deadline: job.deadline ? job.deadline.slice(0, 10) : '',
      skillRequirements: job.skillRequirements.length
        ? job.skillRequirements.map((requirement) => ({ skillId: requirement.skillId, requiredLevel: requirement.requiredLevel }))
        : [{ skillId: '', requiredLevel: 'INTERMEDIATE' }],
    });
    setShowJobForm(true);
  };

  const submitJob = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const chosenSkills = jobDraft.skillRequirements.map((requirement) => ({
      requirement,
      skill: skills.find((skill) => skill.id === requirement.skillId),
    }));
    if (chosenSkills.some(({ skill }) => !skill)) {
      setMessage({ kind: 'error', text: 'Choose a skill from the platform catalog for each job requirement.' });
      return;
    }
    if (new Set(jobDraft.skillRequirements.map(({ skillId }) => skillId)).size !== jobDraft.skillRequirements.length) {
      setMessage({ kind: 'error', text: 'Choose a different catalog skill for each requirement.' });
      return;
    }
    setJobSaving(true);
    setMessage(null);
    try {
      const skillRequirements = chosenSkills.flatMap(({ requirement, skill }) => skill ? [{
        skillId: skill.id,
        isMandatory: true,
        weight: 3,
        requiredLevel: requirement.requiredLevel,
      }] : []);
      const payload = {
        title: jobDraft.title.trim(),
        department: jobDraft.department.trim(),
        jobType: jobDraft.jobType,
        city: jobDraft.city.trim() || workspace?.city || 'Addis Ababa',
        workplaceType: jobDraft.workplaceType,
        summary: jobDraft.summary.trim(),
        responsibilities: jobDraft.responsibilities.split('\n').map((part) => part.trim()).filter(Boolean),
        qualifications: jobDraft.qualifications.split('\n').map((part) => part.trim()).filter(Boolean),
        minExperienceYears: Number(jobDraft.minExperienceYears),
        ...(jobDraft.salaryMinETB ? { salaryMinETB: Number(jobDraft.salaryMinETB) } : {}),
        ...(jobDraft.salaryMaxETB ? { salaryMaxETB: Number(jobDraft.salaryMaxETB) } : {}),
        isSalaryNegotiable: true,
        ...(jobDraft.deadline ? { deadline: new Date(`${jobDraft.deadline}T23:59:59`).toISOString() } : {}),
        skillRequirements,
      };
      const editing = Boolean(editingJobId);
      const existingJobStatus = editingJobId ? jobs.find((job) => job.id === editingJobId)?.status : undefined;
      if (editingJobId) await api.updateJob(editingJobId, payload);
      else await api.createJob(payload);
      setShowJobForm(false);
      setEditingJobId(null);
      setJobDraft(emptyJobDraft());
      setMessage({ kind: 'success', text: editing
        ? `“${jobDraft.title}” was updated. Its publication status remains ${readableStatus(existingJobStatus || 'ACTIVE').toLowerCase()}.`
        : 'Job published. Candidates can apply while the vacancy is active and within its deadline.' });
      await refreshAfterChange();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'The job could not be saved.' });
    } finally {
      setJobSaving(false);
    }
  };

  const improveJobDraftWithAI = async () => {
    const rawDescription = [jobDraft.summary, jobDraft.responsibilities, jobDraft.qualifications].filter(Boolean).join('\n\n');
    if (jobDraft.title.trim().length < 3 || rawDescription.trim().length < 20) {
      setJobAiAdvice('Add a job title and at least 20 characters of role details before requesting AI suggestions.');
      return;
    }
    setJobAiDrafting(true);
    setJobAiAdvice(null);
    try {
      const result = await api.enhanceJobWithAI({
        title: jobDraft.title.trim(),
        rawDescription,
        ...(workspace?.industry ? { industry: workspace.industry } : {}),
      });
      const enhanced = result.data;
      if (!result.success || !enhanced) throw new Error(result.message || 'AI suggestions are unavailable.');
      const suggestedRequirements = (enhanced.suggestedSkills ?? []).flatMap((suggestion: { name: string; requiredLevel: SkillLevel }) => {
        const catalogSkill = skills.find((skill) => skill.name.toLowerCase() === suggestion.name.toLowerCase());
        if (!catalogSkill) return [];
        return [{ skillId: catalogSkill.id, requiredLevel: suggestion.requiredLevel }];
      });
      setJobDraft((current) => ({
        ...current,
        summary: enhanced.enhancedSummary,
        responsibilities: enhanced.clarifiedResponsibilities.join('\n'),
        skillRequirements: [
          ...current.skillRequirements,
          ...suggestedRequirements.filter((suggestion: { skillId: string }) =>
            !current.skillRequirements.some((requirement) => requirement.skillId === suggestion.skillId),
          ),
        ].slice(0, skills.length),
      }));
      setJobAiAdvice(`${enhanced.fairHiringAdvice} AI suggestions are a draft: review and edit all content before saving. Only skills found in the platform catalog were added.`);
    } catch (error) {
      setJobAiAdvice(error instanceof Error ? error.message : 'AI suggestions could not be generated.');
    } finally {
      setJobAiDrafting(false);
    }
  };

  const metric = analytics?.summary;
  const groups = [...new Set(sections.map((section) => section.group))];
  const analyticsApplications = useMemo(() => {
    if (analyticsRange === 'all') return applications.filter((application) => {
      const appliedAt = new Date(application.appliedAt);
      return !Number.isNaN(appliedAt.valueOf()) && appliedAt <= new Date();
    });
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - (Number(analyticsRange) - 1));
    const rangeEnd = new Date();
    return applications.filter((application) => {
      const appliedAt = new Date(application.appliedAt);
      return !Number.isNaN(appliedAt.valueOf()) && appliedAt >= rangeStart && appliedAt <= rangeEnd;
    });
  }, [analyticsRange, applications]);
  const activityPoints = useMemo(
    () => buildActivityPoints(analyticsApplications, analyticsRange),
    [analyticsApplications, analyticsRange],
  );
  const statusCounts = useMemo(() => applicationStatuses.reduce((counts, status) => {
    counts[status] = analyticsApplications.filter((application) => application.status === status).length;
    return counts;
  }, {} as Record<ApplicationStatus, number>), [analyticsApplications]);
  const activeJobCount = jobs.filter((job) => (job.effectiveStatus || job.status) === 'ACTIVE').length;
  const underReviewCount = statusCounts.APPLIED + statusCounts.SCREENING + statusCounts.TECHNICAL_ASSESSMENT;
  const interviewCount = statusCounts.INTERVIEW_SCHEDULED;
  const offerCount = statusCounts.OFFERED;

  const renderJobs = () => (
    <section className="space-y-4" aria-labelledby="employer-jobs-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Workspace</p><h2 id="employer-jobs-title" className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Job Management</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage vacancies belonging to your organization.</p></div>
        <button type="button" onClick={openCreateJobForm} disabled={!workspace?.isApproved} title={!workspace?.isApproved ? 'Business verification is required before using recruiting features.' : undefined} className={primaryButton}><Plus className="h-4 w-4" />Post a job</button>
      </div>
      {!workspace?.isApproved && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Recruiting features are available after your business verification is approved. <button type="button" onClick={() => selectSection('organization')} className="font-semibold underline">Review verification</button></p>}
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="relative"><span className="sr-only">Search jobs</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${controlClass} pl-9`} placeholder="Search title, department, or location" value={jobQuery} onChange={(event) => setJobQuery(event.target.value)} /></label>
        <label><span className="sr-only">Filter jobs by status</span><select className={controlClass} value={jobStatusFilter} onChange={(event) => setJobStatusFilter(event.target.value)}><option value="">All statuses</option>{['ACTIVE', 'DRAFT', 'PAUSED', 'CLOSED', 'EXPIRED'].map((status) => <option key={status} value={status}>{readableStatus(status)}</option>)}</select></label>
      </div>
      {loading && <p className="py-10 text-center text-sm text-slate-500" role="status">Loading your vacancies…</p>}
      {!loading && loadError && <EmptyState title="Vacancies unavailable" detail={loadError} action={<button type="button" onClick={() => void loadData()} className={primaryButton}>Retry</button>} />}
      {!loading && !loadError && filteredJobs.length === 0 && <EmptyState title={jobs.length ? 'No jobs match these filters' : 'No vacancies yet'} detail={jobs.length ? 'Adjust the search or status filter to see your vacancies.' : 'Create your first vacancy to begin receiving applications.'} action={!jobs.length && workspace?.isApproved ? <button type="button" onClick={openCreateJobForm} className={primaryButton}><Plus className="h-4 w-4" />Create a job</button> : undefined} />}
      {!loading && filteredJobs.length > 0 && <div className="grid gap-3 xl:grid-cols-2">{filteredJobs.map((job) => {
        const status = job.effectiveStatus || job.status;
        return <article key={job.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950 dark:text-white">{job.title}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{[job.department, job.city, readableStatus(job.jobType)].filter(Boolean).join(' · ')}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{readableStatus(status)}</span></div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{job.summary}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {[
              ['To review', applications.filter((application) => application.jobId === job.id && application.status === 'APPLIED').length],
              ['Shortlisted', applications.filter((application) => application.jobId === job.id && application.status === 'SHORTLISTED').length],
              ['Interviews', applications.filter((application) => application.jobId === job.id && application.status === 'INTERVIEW_SCHEDULED').length],
            ].map(([label, count]) => <div key={String(label)}><p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">{label}</p><p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900 dark:text-white">{applicationsError || loading ? '—' : Number(count).toLocaleString()}</p></div>)}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm dark:border-slate-800"><span className="text-slate-600 dark:text-slate-400">{job.applicantsCount ?? 0} applications · Deadline {dateLabel(job.deadline)}</span>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={!workspace?.isApproved || busyJob === job.id} onClick={() => openEditJobForm(job)} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">Edit</button>{status !== 'CLOSED' && status !== 'EXPIRED' && <button type="button" disabled={!workspace?.isApproved || busyJob === job.id} title={!workspace?.isApproved ? 'Business verification is required before using recruiting features.' : undefined} onClick={() => void updateJobStatus(job, status === 'PAUSED' ? 'ACTIVE' : status === 'DRAFT' ? 'ACTIVE' : 'PAUSED')} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">{busyJob === job.id ? 'Saving…' : status === 'DRAFT' ? 'Publish' : status === 'PAUSED' ? 'Reopen' : 'Pause'}</button>}{status !== 'CLOSED' && status !== 'EXPIRED' && <button type="button" disabled={!workspace?.isApproved || busyJob === job.id} onClick={() => void updateJobStatus(job, 'CLOSED')} className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40">Close</button>}<button type="button" disabled={!workspace?.isApproved} onClick={() => { setApplicationQuery(''); setApplicationStatusFilter(''); selectSection('applications'); }} className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-cyan-50 px-3 text-xs font-semibold text-cyan-900 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-cyan-950/50 dark:text-cyan-200 dark:hover:bg-cyan-950">View applications<ChevronRight className="h-3.5 w-3.5" /></button></div>
          </div>
        </article>;
      })}</div>}
    </section>
  );

  const renderApplications = () => !workspace?.isApproved
    ? <section className="space-y-4" aria-labelledby="employer-applications-title">
      <div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Workspace</p><h2 id="employer-applications-title" className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Applications</h2></div>
      <EmptyState title="Recruiting is not enabled yet" detail="Employer application details and recruiting actions are available after your business verification is approved." action={<button type="button" onClick={() => selectSection('organization')} className={primaryButton}>Review business verification</button>} />
    </section>
    : (
    <section className="space-y-4" aria-labelledby="employer-applications-title">
      <div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Workspace</p><h2 id="employer-applications-title" className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Applications</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Review applicants for jobs owned by your organization and update their application stage.</p></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_240px]"><label className="relative"><span className="sr-only">Search applications</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><input className={`${controlClass} pl-9`} value={applicationQuery} onChange={(event) => setApplicationQuery(event.target.value)} placeholder="Search candidate or job" /></label><label><span className="sr-only">Filter applications by stage</span><select className={controlClass} value={applicationStatusFilter} onChange={(event) => setApplicationStatusFilter(event.target.value)}><option value="">All stages</option>{applicationStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label></div>
      {selectedApplicationIds.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3 dark:border-cyan-900 dark:bg-cyan-950/30">
        <p className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">{selectedApplicationIds.length} applicant{selectedApplicationIds.length === 1 ? '' : 's'} selected</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => messageSelectedApplications(selectedApplicationIds)} className="min-h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">Message selected</button>
          <button type="button" onClick={() => setSelectedApplicationIds([])} className="min-h-9 rounded-lg border border-cyan-300 px-3 text-xs font-semibold text-cyan-950 dark:border-cyan-800 dark:text-cyan-100">Clear</button>
        </div>
      </div>}
      {loading && !applicationsError && <p className="py-10 text-center text-sm text-slate-500" role="status">Loading applications…</p>}
      {applicationsError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{applicationsError}<button type="button" onClick={() => void loadData()} className="ml-3 font-bold underline">Retry</button></div>}
      {!loading && !applicationsError && filteredApplications.length === 0 && <EmptyState title={applications.length ? 'No applications match these filters' : 'No applications received yet'} detail={applications.length ? 'Try a different search or application stage.' : 'Applications submitted to your vacancies will appear here. Candidate contact details are shown only when their privacy settings allow it.'} />}
      {!loading && filteredApplications.length > 0 && <div className="space-y-3">{filteredApplications.map((application) => {
        const visibleProfile = application.candidateProfileVisibility !== 'PRIVATE';
        const selectable = !['REJECTED', 'WITHDRAWN', 'HIRED'].includes(application.status);
        const nextStatuses = nextApplicationStatuses[application.status];
        return <article key={application.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3">
              <input type="checkbox" aria-label={`Select ${application.candidateName} for a group update`} checked={selectedApplicationIds.includes(application.id)} disabled={!selectable || (!selectedApplicationIds.includes(application.id) && selectedApplicationIds.length >= 100)} onChange={(event) => setSelectedApplicationIds((current) => event.target.checked
                ? [...current, application.id]
                : current.filter((id) => id !== application.id))} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-800 focus:ring-cyan-700 disabled:opacity-40" />
              <div className="min-w-0">
                <h3 className="truncate font-bold text-slate-950 dark:text-white">{application.candidateName}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{application.candidateHeadline || 'Candidate'} · {application.jobTitle}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Applied {dateLabel(application.appliedAt)}{application.matchScore != null ? ` · Skill match ${application.matchScore}%` : ''}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{application.candidateExperienceYears != null ? `${application.candidateExperienceYears} years' experience` : 'Experience not shared'}{application.candidateEducation ? ` · ${application.candidateEducation}` : ''}{application.candidateCity ? ` · ${application.candidateCity}` : ''}</p>
                {application.candidateSkills && <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><span className="font-semibold">Skills:</span> {application.candidateSkills}</p>}
                {application.coverNote && <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{application.coverNote}</p>}
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Profile: {visibleProfile ? 'Shared' : 'Private'} · Last communication: {dateLabel(application.lastCommunicationAt)}</p>
                {(application.candidateEmail || application.candidatePhone) && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Permitted contact: {[application.candidateEmail, application.candidatePhone].filter(Boolean).join(' · ')}</p>}
                {!visibleProfile && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Profile details are limited by the candidate’s privacy settings.</p>}
                <button type="button" onClick={() => messageSelectedApplications([application.id])} disabled={!selectable} className="mt-3 min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Message candidate</button>
              </div>
            </div>
            <label className="w-full shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300 lg:w-56">Application stage
              <select className={`${controlClass} mt-1`} value={application.status} disabled={busyApplication === application.id || nextStatuses.length === 0} onChange={(event) => requestApplicationStatus(application, event.target.value as ApplicationStatus)}>
                <option value={application.status}>{statusLabels[application.status]}</option>
                {nextStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </select>
            </label>
          </div>
        </article>;
      })}</div>}
    </section>
  );

  const renderInterviews = () => {
    const interviewApplications = applications.filter((application) =>
      application.status === 'INTERVIEW_SCHEDULED' || Boolean(application.nextInterviewAt),
    );
    return !workspace?.isApproved
      ? <section className="space-y-4" aria-labelledby="employer-interviews-title">
        <h2 id="employer-interviews-title" className="text-xl font-bold text-slate-950 dark:text-white">Interviews &amp; Shortlisting</h2>
        <EmptyState title="Recruiting is not enabled yet" detail="Interview and shortlist details are available after your business verification is approved." action={<button type="button" onClick={() => selectSection('organization')} className={primaryButton}>Review business verification</button>} />
      </section>
      : <section className="space-y-4" aria-labelledby="employer-interviews-title">
        <header><h2 id="employer-interviews-title" className="text-xl font-bold text-slate-950 dark:text-white">Interviews &amp; Shortlisting</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Application stages and pending interview invitations for your jobs.</p></header>
        {applicationsError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{applicationsError}<button type="button" onClick={() => void loadData()} className="ml-3 font-bold underline">Retry</button></div>}
        {loading && <p role="status" className="py-8 text-center text-sm text-slate-500">Loading interview records…</p>}
        {!loading && !applicationsError && interviewApplications.length === 0 && <EmptyState title="No interviews scheduled" detail="Candidates moved to the interview stage and pending interview invitations will appear here." action={<button type="button" onClick={() => selectSection('applications')} className={primaryButton}>Review applications</button>} />}
        {!applicationsError && <div className="space-y-3">{interviewApplications.map((application) => <article key={application.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><h3 className="font-semibold text-slate-950 dark:text-white">{application.candidateName}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{application.jobTitle} · {statusLabels[application.status]}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{application.nextInterviewAt ? `Pending invitation: ${dateLabel(application.nextInterviewAt)}` : 'No pending invitation date recorded'}</p></div>
          <div className="flex shrink-0 gap-2"><button type="button" onClick={() => messageSelectedApplications([application.id])} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Message candidate</button><button type="button" onClick={() => selectSection('applications')} className="min-h-10 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white dark:bg-slate-100 dark:text-slate-900">Open application</button></div>
        </article>)}</div>}
      </section>;
  };

  const renderProfile = () => {
    const verificationStatus = workspace?.verificationStatus || workspace?.verification?.status || 'NOT_SUBMITTED';
    const hasSubmitted = Boolean(workspace?.verification);
    return <section className="space-y-5" aria-labelledby="employer-organization-title">
      <div><p className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Workspace</p><h2 id="employer-organization-title" className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Organization Profile</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Review your organization information and verification status.</p></div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200"><Building2 className="h-6 w-6" /></div><div><h3 className="text-lg font-bold text-slate-950 dark:text-white">{workspace?.companyName || authEmployer?.companyName || 'Organization profile'}</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{workspace?.industry || 'Industry not provided'}</p></div></div>
          <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-sm dark:border-slate-800 sm:grid-cols-2">{[['City', workspace?.city], ['Website', workspace?.website], ['Organization size', workspace?.employeeRange], ['Description', workspace?.companyOverview]].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-slate-800 dark:text-slate-200">{value || 'Not provided'}</dd></div>)}</dl>
          <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950/60 dark:text-slate-400">Edit organization name, industry, size, location, website, and overview from your account profile. Changing the organization name or industry revokes existing verification until resubmission. Internal review is not official government verification.</p>
          <button type="button" onClick={() => onNavigate('account-profile', { edit: 'true' })} className={`${primaryButton} mt-4`}>Edit organization details<ArrowRight className="h-4 w-4" /></button>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-slate-950 dark:text-white">Business verification</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${workspace?.isApproved ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : verificationStatus === 'REJECTED' ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'}`}>{workspace?.isApproved ? 'Verified' : readableStatus(verificationStatus)}</span></div>
          {workspace?.verification?.reviewNotes && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Reviewer feedback: {workspace.verification.reviewNotes}</p>}
          {workspace?.isApproved ? <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">Your organization is approved. Please keep its business information current.</p> : verificationStatus === 'PENDING' ? <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">Your verification request is awaiting administrator review. A second request cannot be submitted while this review is pending.</p> : <>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{hasSubmitted ? 'Update your business details and resubmit for review.' : 'Submit your business identifiers for internal review. Supporting documents can be uploaded privately after submission.'}</p>
            <form onSubmit={(event) => void submitVerification(event)} className="mt-4 space-y-3"><label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Tax Identification Number<input required minLength={8} maxLength={100} className={`${controlClass} mt-1`} value={tinNumber} onChange={(event) => setTinNumber(event.target.value)} /></label><label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Business license number<input required minLength={5} maxLength={100} className={`${controlClass} mt-1`} value={businessLicenseNo} onChange={(event) => setBusinessLicenseNo(event.target.value)} /></label><button type="submit" disabled={verificationSaving} className={`${primaryButton} w-full`}>{verificationSaving ? 'Submitting…' : hasSubmitted ? 'Resubmit for review' : 'Submit for verification'}</button></form>
          </>}
          {hasSubmitted && !['APPROVED', 'REJECTED'].includes(verificationStatus) && <div className="mt-5 space-y-3 border-t border-slate-100 pt-5 dark:border-slate-800">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Supporting documents</h4>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Private uploads are limited to PDF, JPG, or PNG files up to 4 MB. Verify your account email before uploading.</p>
            </div>
            {verificationDocumentsError && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{verificationDocumentsError}</p>}
            {verificationDocuments.length > 0 ? <ul className="space-y-2">
              {verificationDocuments.map((document) => <li key={document.id} className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{document.originalFilename}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{readableStatus(document.status)}</span>
                </div>
                <p className="mt-1 text-slate-500 dark:text-slate-400">{readableStatus(document.category)} · Submitted {dateLabel(document.submittedAt)} · {(document.sizeBytes / 1024).toFixed(0)} KB</p>
                {document.reviewNotes && <p className="mt-2 text-amber-800 dark:text-amber-200">Reviewer feedback: {document.reviewNotes}</p>}
              </li>)}
            </ul> : !verificationDocumentsError && <p className="text-xs text-slate-500 dark:text-slate-400">No supporting documents uploaded.</p>}
            <form onSubmit={(event) => void submitVerificationDocument(event)} className="grid gap-3 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Document type
                <select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value as EmployerVerificationDocument['category'])} className={`${controlClass} mt-1`}>
                  <option value="BUSINESS_REGISTRATION">Business registration</option>
                  <option value="TIN_CERTIFICATE">TIN certificate</option>
                  <option value="SUPPORTING">Other supporting document</option>
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Document file
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} className={`${controlClass} mt-1 py-2`} />
              </label>
              <button type="submit" disabled={documentSaving || !documentFile} className={primaryButton}>{documentSaving ? 'Uploading…' : 'Upload privately'}</button>
            </form>
          </div>}
          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">Never share passwords, API keys, or account credentials in verification fields.</p>
        </article>
      </div>
    </section>;
  };

  const renderAnalytics = () => !workspace?.isApproved
    ? <section className="space-y-5" aria-labelledby="employer-analytics-title">
      <h2 id="employer-analytics-title" className="text-xl font-bold text-slate-950 dark:text-white">Recruitment Analytics</h2>
      <EmptyState title="Recruiting is not enabled yet" detail="Recruitment analytics are available after your business verification is approved." action={<button type="button" onClick={() => selectSection('organization')} className={primaryButton}>Review business verification</button>} />
    </section>
    : (
    <section className="space-y-5" aria-labelledby="employer-analytics-title">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="employer-analytics-title" className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Recruitment Analytics</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">A clear view of your vacancies and application pipeline.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Application period
            <select className={`${controlClass} mt-1 min-h-10 w-auto min-w-36`} value={analyticsRange} onChange={(event) => setAnalyticsRange(event.target.value as AnalyticsRange)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All time</option>
            </select>
          </label>
          <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Refresh analytics">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh
          </button>
        </div>
      </header>

      {applicationsError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
        <p className="font-semibold">Application analytics could not be loaded.</p>
        <p className="mt-1">{applicationsError}</p>
        <button type="button" onClick={() => void loadData()} className="mt-2 font-bold underline">Try again</button>
      </div>}

      {loadError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
        <p className="font-semibold">Vacancy data could not be loaded.</p>
        <p className="mt-1">{loadError}</p>
        <button type="button" onClick={() => void loadData()} className="mt-2 font-bold underline">Try again</button>
      </div>}

      {analyticsError && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200" role="status">
        Supplementary analytics summary unavailable. The charts below use the employer application records.
      </div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: 'Total jobs', value: jobs.length, unavailable: Boolean(loadError), note: 'All statuses', destination: 'jobs' as Section },
          { label: 'Active jobs', value: activeJobCount, unavailable: Boolean(loadError), note: 'Currently open', destination: 'jobs' as Section },
          { label: 'Applications', value: analyticsApplications.length, unavailable: Boolean(applicationsError), note: 'Selected period', destination: 'applications' as Section },
          { label: 'In review', value: underReviewCount, unavailable: Boolean(applicationsError), note: 'New, screening, assessment', destination: 'applications' as Section },
          { label: 'Interviews', value: interviewCount, unavailable: Boolean(applicationsError), note: 'Scheduled', destination: 'applications' as Section },
          { label: 'Offers', value: offerCount, unavailable: Boolean(applicationsError), note: 'Current stage', destination: 'applications' as Section },
        ].map((item) => <button key={item.label} type="button" onClick={() => selectSection(item.destination)} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
          <span className="mt-2 block text-2xl font-bold tabular-nums text-slate-950 dark:text-white">{item.unavailable ? '—' : item.value.toLocaleString()}</span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{item.note}</span>
        </button>)}
      </div>

      {loading && <p className="text-xs text-slate-500 dark:text-slate-400" role="status">Refreshing employer records…</p>}

      {!applicationsError && !loadError && !loading && analyticsApplications.length === 0
        ? <article className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900 sm:p-8">
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{applications.length ? 'No applications in this period' : 'Start building your applicant pipeline'}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{applications.length
              ? 'Try a wider date range to see earlier activity, or review your vacancies.'
              : 'Application trends and stage insights will appear here once candidates apply to your vacancies.'}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {applications.length > 0 && <button type="button" onClick={() => setAnalyticsRange('all')} className={primaryButton}>View all time</button>}
              {applications.length === 0 && <button type="button" onClick={openCreateJobForm} disabled={!workspace?.isApproved} className={primaryButton}><Plus className="h-4 w-4" />Post a job</button>}
              <button type="button" onClick={() => selectSection('jobs')} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">View jobs<ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
        </article>
        : !applicationsError && !loadError && analyticsApplications.length > 0 && <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
            <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 className="font-semibold text-slate-950 dark:text-white">Application activity</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Submissions received during the selected period.</p></div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">{analyticsApplications.length} total</span>
              </div>
              <ApplicationActivityChart points={activityPoints} />
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
              <div><h3 className="font-semibold text-slate-950 dark:text-white">Recruitment pipeline</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Current stages for applications in this period.</p></div>
              <div className="mt-5 space-y-4">
                {applicationStatuses.filter((status) => statusCounts[status] > 0).map((status) => {
                  const count = statusCounts[status];
                  const percent = Math.round((count / analyticsApplications.length) * 100);
                  return <div key={status}>
                    <div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="text-slate-700 dark:text-slate-300">{statusLabels[status]}</span><span className="tabular-nums text-slate-500 dark:text-slate-400">{count} · {percent}%</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-slate-700 dark:bg-slate-300" style={{ width: `${percent}%` }} /></div>
                  </div>;
                })}
              </div>
              <button type="button" onClick={() => selectSection('applications')} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600 dark:text-slate-200">Review applications<ArrowRight className="h-4 w-4" /></button>
            </article>
          </div>

          {(() => {
            const jobCounts = analyticsApplications.reduce<Record<string, number>>((counts, application) => {
              counts[application.jobId] = (counts[application.jobId] ?? 0) + 1;
              return counts;
            }, {});
            const topJobs = Object.entries(jobCounts)
              .map(([jobId, count]) => ({ job: jobs.find((item) => item.id === jobId), count }))
              .filter((item): item is { job: Job; count: number } => Boolean(item.job))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5);
            const jobsWithoutApplications = jobs.filter((job) => (job.effectiveStatus || job.status) === 'ACTIVE' && !jobCounts[job.id]).length;
            const busiestStatus = applicationStatuses
              .filter((status) => statusCounts[status] > 0)
              .sort((a, b) => statusCounts[b] - statusCounts[a])[0];

            return <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
              <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-950 dark:text-white">Job performance</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Ranked by applications received in this period.</p></div><button type="button" onClick={() => selectSection('jobs')} className="text-xs font-semibold text-slate-700 hover:underline dark:text-slate-200">All jobs</button></div>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                  {topJobs.map(({ job, count }) => <button key={job.id} type="button" onClick={() => { setJobQuery(job.title); selectSection('jobs'); }} className="flex w-full items-center justify-between gap-3 py-3 text-left first:pt-1 last:pb-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-600">
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{job.title}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{readableStatus(job.effectiveStatus || job.status)}</span></span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">{count} {count === 1 ? 'application' : 'applications'}</span>
                  </button>)}
                  {topJobs.length === 0 && <p className="py-4 text-sm text-slate-500 dark:text-slate-400">No matching vacancy records are available for these applications.</p>}
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                <h3 className="font-semibold text-slate-950 dark:text-white">Hiring insights</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Based on recorded applications and current vacancy status.</p>
                <ul className="mt-4 space-y-3 text-sm">
                  {topJobs[0] && <li className="flex justify-between gap-3"><span className="text-slate-600 dark:text-slate-400">Most applications</span><span className="text-right font-semibold text-slate-800 dark:text-slate-200">{topJobs[0].job.title} ({topJobs[0].count})</span></li>}
                  {busiestStatus && <li className="flex justify-between gap-3"><span className="text-slate-600 dark:text-slate-400">Largest stage</span><span className="font-semibold text-slate-800 dark:text-slate-200">{statusLabels[busiestStatus]} ({statusCounts[busiestStatus]})</span></li>}
                  <li className="flex justify-between gap-3"><span className="text-slate-600 dark:text-slate-400">Active jobs without applications in period</span><span className="font-semibold tabular-nums text-slate-800 dark:text-slate-200">{jobsWithoutApplications}</span></li>
                </ul>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">First-response time and hires aren’t shown because application status history and a hired stage aren’t recorded.</p>
              </article>
            </div>;
          })()}
        </>}
    </section>
  );

  const overviewMetrics: Array<{ label: string; value: number | null; icon: LucideIcon; destination: Section }> = [
    { label: 'Active jobs', value: loadError || loading ? null : activeJobCount, icon: Briefcase, destination: 'jobs' },
    { label: 'Total applicants', value: applicationsError || loading ? null : new Set(applications.map((application) => application.jobSeekerId)).size, icon: Users, destination: 'applications' },
    { label: 'To review', value: applicationsError || loading ? null : applications.filter((application) => application.status === 'APPLIED').length, icon: FileText, destination: 'applications' },
    { label: 'Shortlisted', value: applicationsError || loading ? null : applications.filter((application) => application.status === 'SHORTLISTED').length, icon: CheckCircle2, destination: 'applications' },
    { label: 'Interviews', value: applicationsError || loading ? null : applications.filter((application) => application.status === 'INTERVIEW_SCHEDULED').length, icon: Clock, destination: 'interviews' },
    { label: 'Unread messages', value: unreadMessageCount, icon: Mail, destination: 'messages' },
  ];

  const renderOverview = () => (
    <section className="space-y-4" aria-labelledby="employer-overview-title">
      <DashboardPageHeader
        eyebrow="Employer workspace"
        title={`Welcome${user?.fullName ? `, ${user.fullName}` : ''}`}
        titleId="employer-overview-title"
        description={workspace?.companyName || authEmployer?.companyName || 'Manage your organization and recruitment activity.'}
        actions={<button type="button" onClick={openCreateJobForm} disabled={!workspace?.isApproved} title={!workspace?.isApproved ? 'Business verification is required before using recruiting features.' : undefined} className={primaryButton}><Plus className="h-4 w-4" />Post a job</button>}
      />
      {workspace && !workspace.isApproved && <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" /><div><p className="font-semibold text-amber-950 dark:text-amber-100">Organization verification: {readableStatus(workspace.verificationStatus || workspace.verification?.status || 'NOT_SUBMITTED')}</p><p className="mt-1 text-sm text-amber-900/80 dark:text-amber-200/80">Recruiting features are available after your business verification is approved.</p></div></div><button type="button" onClick={() => selectSection('organization')} className="min-h-9 shrink-0 rounded-lg border border-amber-300 px-3 text-sm font-semibold text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-950">Review status</button></div>}
      {loadError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{loadError}<button type="button" onClick={() => void loadData()} className="ml-3 font-bold underline">Retry</button></div>}
      {loading && !workspace && <p className="py-10 text-center text-sm text-slate-500" role="status">Loading your organization workspace…</p>}
      {workspace && <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{overviewMetrics.map(({ label, value, icon: MetricIcon, destination }) => (
        <DashboardMetricCard
          key={label}
          label={label}
          value={value === null ? '—' : value.toLocaleString()}
          detail={`View ${destination}`}
          icon={MetricIcon}
          onClick={() => selectSection(destination)}
          ariaLabel={`${label}: ${value === null ? 'unavailable' : value.toLocaleString()}`}
          className="transition hover:border-cyan-300 hover:shadow-md dark:hover:border-cyan-800"
        />
      ))}</div>
      {applicationsError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">Applicant metrics unavailable: {applicationsError}</p>}
      <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-bold text-slate-950 dark:text-white">Recruitment pipeline</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Live application counts by stage across your organization.</p></div><button type="button" onClick={() => selectSection('applications')} className="text-xs font-bold text-cyan-800 hover:underline dark:text-cyan-300">Manage applications</button></div>
        {applicationsError ? <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Pipeline data is unavailable until applications load.</p> : <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">{(['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW_SCHEDULED', 'OFFERED', 'HIRED', 'REJECTED'] as ApplicationStatus[]).map((status) => <div key={status} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60"><p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{statusLabels[status]}</p><p className="mt-1 text-xl font-bold tabular-nums text-slate-950 dark:text-white">{applications.filter((application) => application.status === status).length}</p></div>)}</div>}
      </article>
      <div className="grid gap-3 xl:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950 dark:text-white">Recent applications</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Latest applicants to your organization’s vacancies.</p></div><button type="button" disabled={!workspace.isApproved} onClick={() => selectSection('applications')} className="text-xs font-bold text-cyan-800 hover:underline disabled:opacity-50 dark:text-cyan-300">View all</button></div>{!workspace.isApproved ? <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Application details are available after business verification is approved.</p> : applications.length === 0 ? <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Applications will appear here when candidates apply to your vacancies.</p> : <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{applications.slice(0, 5).map((application) => <div key={application.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{application.candidateName}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{application.jobTitle} · {dateLabel(application.appliedAt)}</p></div><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{statusLabels[application.status]}</span></div>)}</div>}</article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-slate-950 dark:text-white">Your vacancies</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recently created jobs and their current status.</p></div><button type="button" onClick={() => selectSection('jobs')} className="text-xs font-bold text-cyan-800 hover:underline dark:text-cyan-300">Manage jobs</button></div>{jobs.length === 0 ? <EmptyState title="No jobs posted" detail="Create a vacancy when your organization is ready to recruit." action={workspace.isApproved ? <button type="button" onClick={openCreateJobForm} className={primaryButton}><Plus className="h-4 w-4" />Create your first job</button> : undefined} /> : <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">{jobs.slice(0, 5).map((job) => <div key={job.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{job.title}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{job.city} · {job.applicantsCount ?? 0} applications</p></div><div className="flex shrink-0 items-center gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{readableStatus(job.status)}</span><button type="button" onClick={() => openEditJobForm(job)} aria-label={`Edit ${job.title}`} className="min-h-8 rounded-lg border border-slate-300 px-2 text-[10px] font-semibold dark:border-slate-700">Edit</button></div></div>)}</div>}</article></div></>}
    </section>
  );

  const renderUnavailable = () => {
    const reason: Record<'discovery', string> = {
      discovery: 'Candidate discovery requires an approved employer organization and candidates who have opted in to employer search. Private or opted-out profiles are not shown.',
    };
    return <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"><div className="mx-auto max-w-xl py-8 text-center"><HelpCircle className="mx-auto h-10 w-10 text-slate-400" /><h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">{currentItem.label}</h2><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{reason[activeSection as keyof typeof reason]}</p><p className="mt-4 text-xs text-slate-500 dark:text-slate-400">This section is intentionally unavailable rather than showing sample records or nonfunctional actions.</p></div></section>;
  };

  const renderContent = () => {
    if (activeSection === 'overview') return renderOverview();
    if (activeSection === 'organization') return renderProfile();
    if (activeSection === 'jobs') return renderJobs();
    if (activeSection === 'applications') return renderApplications();
    if (activeSection === 'discovery') return <CandidateDiscoveryPage
      isVerified={Boolean(workspace?.isApproved)}
      isVerificationLoading={!workspace && loading}
      verificationUnavailable={!workspace && Boolean(loadError)}
      onNavigate={onNavigate}
      onReviewVerification={() => selectSection('organization')}
      onRetryVerification={() => void loadData()}
    />;
    if (activeSection === 'interviews') return renderInterviews();
    if (activeSection === 'analytics') return renderAnalytics();
    if (activeSection === 'reports') return <EmployerReportsPage isVerified={Boolean(workspace?.isApproved)} />;
    if (activeSection === 'messages') return <EmployerMessagesPanel
      applications={applications}
      isVerified={Boolean(workspace?.isApproved)}
      onNavigate={onNavigate}
      onReviewVerification={() => selectSection('organization')}
      requestedApplicationId={searchParams.get('applicationId')}
      requestedApplicationIds={searchParams.get('applicationIds')?.split(',').filter(Boolean)}
    />;
    return renderUnavailable();
  };

  const renderNavigation = (mobile = false, collapsed = false) => groups.map((group) => <div key={group} className="space-y-1">{(!collapsed || mobile) && <p className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400 first:pt-0 dark:text-slate-500">{group}</p>}{sections.filter((item) => item.group === group).map(({ id, label, icon: Icon, available }) => <button key={id} type="button" onClick={() => selectSection(id)} aria-current={activeSection === id ? 'page' : undefined} aria-label={collapsed && !mobile ? label : undefined} title={!available ? 'This page is not yet supported by the backend.' : collapsed && !mobile ? label : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 ${collapsed && !mobile ? 'justify-center px-2' : ''} ${activeSection === id ? 'bg-cyan-50 text-cyan-950 dark:bg-cyan-950/50 dark:text-cyan-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'} ${!available ? 'opacity-70' : ''}`}><Icon className="h-4 w-4 shrink-0" /><span className={`${collapsed && !mobile ? 'sr-only' : 'min-w-0 flex-1 truncate'}`}>{label}</span>{!available && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />}</button>)}</div>);

  return (
    <div className="dashboard-shell min-h-[calc(100vh-4rem)] text-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-screen-2xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="sb-glass mb-4 flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/75 lg:hidden"><div className="min-w-0"><p className="truncate text-xs font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">SKILLBRIDGE ET · Employer workspace</p><p className="truncate text-sm font-bold text-slate-950 dark:text-white">{currentItem.label}</p></div></div>
        <div className={`grid min-h-[calc(100vh-8rem)] gap-5 ${sidebarCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[248px_minmax(0,1fr)]'}`}>
          <aside className={`sb-glass sb-clay hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/75 lg:block ${sidebarCollapsed ? 'px-2' : ''}`}><div className={`mb-5 flex items-center border-b border-slate-200 pb-4 dark:border-slate-800 ${sidebarCollapsed ? 'justify-center' : 'justify-between gap-3'}`}>{!sidebarCollapsed && <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#10243c] text-white"><Building2 className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-extrabold text-slate-950 dark:text-white">SKILLBRIDGE ET</p><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employer workspace</p></div></div>}<button type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? 'Expand employer navigation' : 'Collapse employer navigation'} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-600 dark:text-slate-300 dark:hover:bg-slate-800">{sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button></div>{renderNavigation(false, sidebarCollapsed)}<div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800"><button type="button" title={sidebarCollapsed ? 'Settings' : undefined} onClick={() => onNavigate('account-profile')} className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${sidebarCollapsed ? 'justify-center px-2' : ''}`}><Settings className="h-4 w-4 shrink-0" /><span className={sidebarCollapsed ? 'sr-only' : ''}>Settings</span></button></div></aside>
          <main className="sb-content-panel min-w-0 rounded-2xl border border-white/70 bg-white/55 p-4 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/45 sm:p-6 lg:p-7">
            <div className="mb-6 hidden items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800 lg:flex"><div><p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Employer Workspace <span className="px-1 text-slate-300">/</span> {currentItem.group}</p><h1 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{currentItem.label}</h1></div><div className="text-right"><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{workspace?.companyName || authEmployer?.companyName || user?.fullName}</p><p className="text-xs text-slate-500 dark:text-slate-400">{workspace?.isApproved ? 'Verified organization' : 'Verification not complete'}</p></div></div>
            {message && <div className={`mb-5 flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${message.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'}`} role={message.kind === 'error' ? 'alert' : 'status'}><span>{message.text}</span><button type="button" onClick={() => setMessage(null)} aria-label="Dismiss message"><X className="h-4 w-4" /></button></div>}
            {renderContent()}
          </main>
        </div>
      </div>
      {pendingStatusChange && (() => {
        const allowedStatuses = nextApplicationStatuses[pendingStatusChange.application.status];
        const availableTemplates = allowedStatuses.map((status) => ({
          status,
          ...applicationStageTemplates[status],
        })).filter((template): template is { status: ApplicationStatus; label: string; note: string } => Boolean(template.label && template.note));
        return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="application-stage-dialog-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-950">
            <h2 id="application-stage-dialog-title" className="text-lg font-bold text-slate-950 dark:text-white">Confirm application stage change</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{pendingStatusChange.application.candidateName} · {pendingStatusChange.application.jobTitle}</p>
            <label className="mt-4 block text-xs font-semibold text-slate-700 dark:text-slate-300">Stage and candidate notification
              <select autoFocus className={`${controlClass} mt-1`} value={pendingStatusChange.status} onChange={(event) => {
                const nextStatus = event.target.value as ApplicationStatus;
                const template = applicationStageTemplates[nextStatus];
                setPendingStatusChange((current) => current ? {
                  ...current,
                  status: nextStatus,
                  note: template?.note || `Your application for ${current.application.jobTitle} is now ${statusLabels[nextStatus].toLowerCase()}.`,
                } : current);
              }}>
                {availableTemplates.map((template) => <option key={template.status} value={template.status}>{template.label}</option>)}
                {allowedStatuses.filter((status) => !applicationStageTemplates[status]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-700 dark:text-slate-300">Notification message
              <textarea maxLength={1000} rows={4} value={pendingStatusChange.note} onChange={(event) => setPendingStatusChange((current) => current ? { ...current, note: event.target.value } : current)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              <span className="mt-1 block font-normal text-slate-500 dark:text-slate-400">This stage update is saved to the application and its notification is delivered privately to this candidate.</span>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={busyApplication === pendingStatusChange.application.id} onClick={() => setPendingStatusChange(null)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button>
              <button type="button" disabled={busyApplication === pendingStatusChange.application.id || !pendingStatusChange.note.trim()} onClick={() => void updateApplicationStatus(pendingStatusChange.application, pendingStatusChange.status, pendingStatusChange.note)} className={primaryButton}>{busyApplication === pendingStatusChange.application.id ? 'Saving…' : 'Confirm stage change'}</button>
            </div>
          </section>
        </div>;
      })()}
      {showJobForm && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:items-center sm:p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="create-employer-job-title" className="max-h-[95dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:rounded-2xl sm:p-6"><div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800"><div><h2 id="create-employer-job-title" className="text-lg font-bold text-slate-950 dark:text-white">{editingJobId ? 'Edit job vacancy' : 'Create a job vacancy'}</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Only job details and skill requirements are changed; application records and current job status are preserved.</p></div><button type="button" onClick={() => { setShowJobForm(false); setEditingJobId(null); }} aria-label="Close job form" className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button></div>
        <form onSubmit={(event) => void submitJob(event)} className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 dark:border-cyan-900 dark:bg-cyan-950/30 sm:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold text-cyan-950 dark:text-cyan-100">AI-assisted job draft</p><p className="mt-1 text-xs text-cyan-900/80 dark:text-cyan-200/80">Generate job-related writing and catalog skill suggestions. Review every suggestion; AI does not evaluate or select candidates.</p></div><button type="button" disabled={jobAiDrafting} onClick={() => void improveJobDraftWithAI()} className="min-h-9 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">{jobAiDrafting ? 'Generating…' : 'Suggest improvements'}</button></div>
            {jobAiAdvice && <p role="status" className="mt-2 text-xs leading-5 text-cyan-950 dark:text-cyan-100">{jobAiAdvice}</p>}
          </div>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Job title<input className={`${controlClass} mt-1`} required minLength={3} maxLength={160} value={jobDraft.title} onChange={(event) => setJobDraft({ ...jobDraft, title: event.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Department<input className={`${controlClass} mt-1`} maxLength={100} value={jobDraft.department} onChange={(event) => setJobDraft({ ...jobDraft, department: event.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Employment type<select className={`${controlClass} mt-1`} value={jobDraft.jobType} onChange={(event) => setJobDraft({ ...jobDraft, jobType: event.target.value as Job['jobType'] })}>{(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE', 'HYBRID'] as const).map((type) => <option key={type} value={type}>{readableStatus(type)}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Workplace type<select className={`${controlClass} mt-1`} value={jobDraft.workplaceType} onChange={(event) => setJobDraft({ ...jobDraft, workplaceType: event.target.value })}><option>On-site</option><option>Remote</option><option>Hybrid</option></select></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">City<input className={`${controlClass} mt-1`} maxLength={100} value={jobDraft.city} onChange={(event) => setJobDraft({ ...jobDraft, city: event.target.value })} placeholder={workspace?.city || 'Addis Ababa'} /></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Minimum experience (years)<input type="number" min="0" max="60" className={`${controlClass} mt-1`} value={jobDraft.minExperienceYears} onChange={(event) => setJobDraft({ ...jobDraft, minExperienceYears: event.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">Role summary<textarea className={`${controlClass} mt-1 min-h-24 py-2`} required minLength={10} maxLength={4000} value={jobDraft.summary} onChange={(event) => setJobDraft({ ...jobDraft, summary: event.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Responsibilities (one per line)<textarea className={`${controlClass} mt-1 min-h-20 py-2`} maxLength={4000} value={jobDraft.responsibilities} onChange={(event) => setJobDraft({ ...jobDraft, responsibilities: event.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Qualifications (one per line)<textarea className={`${controlClass} mt-1 min-h-20 py-2`} maxLength={4000} value={jobDraft.qualifications} onChange={(event) => setJobDraft({ ...jobDraft, qualifications: event.target.value })} /></label>
          <fieldset className="space-y-3 sm:col-span-2"><legend className="text-xs font-semibold text-slate-700 dark:text-slate-300">Required skills and proficiency</legend>{jobDraft.skillRequirements.map((requirement, index) => <div key={index} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px_auto]"><label className="text-xs font-semibold text-slate-700 dark:text-slate-300"><span className="sr-only">Skill {index + 1}</span><select className={controlClass} required value={requirement.skillId} onChange={(event) => setJobDraft((current) => ({ ...current, skillRequirements: current.skillRequirements.map((item, itemIndex) => itemIndex === index ? { ...item, skillId: event.target.value } : item) }))}><option value="">Choose from the skills catalog</option>{skills.map((skill) => <option key={skill.id} value={skill.id} disabled={jobDraft.skillRequirements.some((item, itemIndex) => itemIndex !== index && item.skillId === skill.id)}>{skill.name}{skill.category ? ` · ${skill.category}` : ''}</option>)}</select></label><label className="text-xs font-semibold text-slate-700 dark:text-slate-300"><span className="sr-only">Skill {index + 1} proficiency</span><select className={controlClass} value={requirement.requiredLevel} onChange={(event) => setJobDraft((current) => ({ ...current, skillRequirements: current.skillRequirements.map((item, itemIndex) => itemIndex === index ? { ...item, requiredLevel: event.target.value as SkillLevel } : item) }))}>{(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const).map((level) => <option key={level}>{readableStatus(level)}</option>)}</select></label>{jobDraft.skillRequirements.length > 1 && <button type="button" onClick={() => setJobDraft((current) => ({ ...current, skillRequirements: current.skillRequirements.filter((_item, itemIndex) => itemIndex !== index) }))} aria-label={`Remove skill ${index + 1}`} className="min-h-11 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Remove</button>}</div>)}<button type="button" disabled={skills.length === 0 || jobDraft.skillRequirements.length >= skills.length} onClick={() => setJobDraft((current) => ({ ...current, skillRequirements: [...current.skillRequirements, { skillId: '', requiredLevel: 'INTERMEDIATE' }] }))} className="min-h-9 rounded-lg border border-cyan-300 px-3 text-xs font-semibold text-cyan-900 hover:bg-cyan-50 disabled:opacity-50 dark:border-cyan-900 dark:text-cyan-200 dark:hover:bg-cyan-950/40">Add a skill requirement</button>{skillsError && <p className="text-xs text-rose-700 dark:text-rose-300">{skillsError}</p>}</fieldset>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Minimum salary (ETB)<input type="number" min="0" step="1" className={`${controlClass} mt-1`} value={jobDraft.salaryMinETB} onChange={(event) => setJobDraft({ ...jobDraft, salaryMinETB: event.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Maximum salary (ETB)<input type="number" min="0" step="1" className={`${controlClass} mt-1`} value={jobDraft.salaryMaxETB} onChange={(event) => setJobDraft({ ...jobDraft, salaryMaxETB: event.target.value })} /></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 sm:col-span-2">Application deadline<input type="date" min={new Date().toISOString().slice(0, 10)} className={`${controlClass} mt-1`} value={jobDraft.deadline} onChange={(event) => setJobDraft({ ...jobDraft, deadline: event.target.value })} /></label>
          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:col-span-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setShowJobForm(false); setEditingJobId(null); }} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Cancel</button><button type="submit" disabled={jobSaving || skills.length === 0} className={primaryButton}>{jobSaving ? 'Saving…' : editingJobId ? 'Save job changes' : 'Create and publish job'}</button></div>
        </form>
      </section></div>}
    </div>
  );
};
