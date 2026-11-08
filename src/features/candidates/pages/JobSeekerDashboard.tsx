import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/src/app/providers/AuthContext';
import { Application, ApplicationStatus, Job, SkillLevel, JobSeekerSkill } from '@/shared/types';
import {
  api,
  type CandidateSkillAssessment,
  type CandidateSkillAssessmentQuestion,
  type CandidateSkillAssessmentResult,
} from '@/src/services/api-client';
import { DashboardLayout } from '@/src/components/shared/DashboardLayout';
import { DashboardMetricCard } from '@/src/components/shared/DashboardPrimitives';
import { CareerParticleField } from '@/src/components/shared/CareerParticleField';
import { CandidateMessagesPanel } from '../components/CandidateMessagesPanel';
import { 
  User, 
  Briefcase, 
  GraduationCap, 
  MapPin, 
  Plus, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  ExternalLink, 
  ChevronRight, 
  ShieldCheck, 
  Sparkles, 
  BookOpen, 
  Bookmark, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  Shield, 
  Check, 
  Info, 
  Lock, 
  Award, 
  Compass, 
  ArrowUpRight,
  Mail,
  Target,
} from 'lucide-react';

interface JobSeekerDashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

type JobSeekerTab = 'overview' | 'recommendations' | 'applications' | 'messages' | 'saved' | 'skills' | 'roadmap';
type DashboardDataSection = 'applications' | 'saved jobs' | 'job recommendations' | 'career roadmap' | 'messages';
const jobSeekerTabs: JobSeekerTab[] = ['overview', 'recommendations', 'applications', 'messages', 'saved', 'skills', 'roadmap'];
const isJobSeekerTab = (tab: string): tab is JobSeekerTab => jobSeekerTabs.includes(tab as JobSeekerTab);

function isJobUnavailable(job: { status?: string; effectiveStatus?: string; deadline?: string | null }) {
  if (job.status !== undefined && job.status !== 'ACTIVE') return true;
  if (job.effectiveStatus === 'EXPIRED') return true;
  if (!job.deadline) return false;
  const deadline = new Date(job.deadline);
  if (Number.isNaN(deadline.getTime())) return false;
  deadline.setHours(23, 59, 59, 999);
  return deadline.getTime() < Date.now();
}

const applicationStatusLabel: Record<ApplicationStatus, string> = {
  APPLIED: 'Submitted',
  SCREENING: 'Under review',
  SHORTLISTED: 'Shortlisted',
  TECHNICAL_ASSESSMENT: 'Technical assessment',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  OFFERED: 'Offered',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

function applicationStatusClass(status: ApplicationStatus) {
  if (status === 'OFFERED' || status === 'HIRED') return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
  if (status === 'REJECTED' || status === 'WITHDRAWN') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  if (status === 'INTERVIEW_SCHEDULED' || status === 'TECHNICAL_ASSESSMENT') return 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200';
  if (status === 'SHORTLISTED') return 'bg-cyan-50 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200';
  return 'bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200';
}

export const JobSeekerDashboard: React.FC<JobSeekerDashboardProps> = ({ onNavigate }) => {
  const { user, candidateProfile, refreshCandidate, logout } = useAuth();
  const location = useLocation();
  const [applications, setApplications] = useState<Application[]>([]);
  const [savedJobs, setSavedJobs] = useState<any[]>([]);
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
  const [learningPath, setLearningPath] = useState<any | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState<number | null>(null);
  const [completedMilestones, setCompletedMilestones] = useState<Record<number, boolean>>({});
  const [milestoneStorageError, setMilestoneStorageError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<JobSeekerTab>('overview');
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<DashboardDataSection[]>([]);
  const [savingJobIds, setSavingJobIds] = useState<string[]>([]);
  const [applicationQuery, setApplicationQuery] = useState('');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('ALL');
  const [savedQuery, setSavedQuery] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const [candidateSkills, setCandidateSkills] = useState<JobSeekerSkill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillActionError, setSkillActionError] = useState<string | null>(null);
  const [skillAssessments, setSkillAssessments] = useState<CandidateSkillAssessment[]>([]);
  const [assessmentsError, setAssessmentsError] = useState<string | null>(null);
  const [updatingSkillId, setUpdatingSkillId] = useState<string | null>(null);
  const [removingSkillId, setRemovingSkillId] = useState<string | null>(null);
  const [newSkillYears, setNewSkillYears] = useState(0);
  const [assessmentSkill, setAssessmentSkill] = useState<JobSeekerSkill | null>(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState<CandidateSkillAssessmentQuestion[]>([]);
  const [assessmentAnswers, setAssessmentAnswers] = useState<Record<string, number>>({});
  const [assessmentResult, setAssessmentResult] = useState<CandidateSkillAssessmentResult | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentSubmitting, setAssessmentSubmitting] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab')
      || new URLSearchParams(location.hash.replace(/^#/, '')).get('tab');
    if (tab && isJobSeekerTab(tab)) setActiveTab(tab);
  }, [location.hash, location.search]);

  useEffect(() => {
    if (!candidateProfile) {
      setCompletedMilestones({});
      return;
    }
    try {
      const stored = localStorage.getItem(`skillbridge_milestones_completed_${candidateProfile.id}`);
      const parsed: unknown = stored ? JSON.parse(stored) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid roadmap progress');
      const progress: Record<number, boolean> = {};
      for (const [key, value] of Object.entries(parsed)) {
        const step = Number(key);
        if (!Number.isInteger(step) || step < 1 || typeof value !== 'boolean') throw new Error('Invalid roadmap progress');
        progress[step] = value;
      }
      setCompletedMilestones(progress);
      setMilestoneStorageError(null);
    } catch {
      setCompletedMilestones({});
      setMilestoneStorageError('Roadmap progress could not be loaded from this browser.');
    }
  }, [candidateProfile?.id]);

  // Edit Profile Modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editHeadline, setEditHeadline] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editDesiredRole, setEditDesiredRole] = useState('');
  const [editSalary, setEditSalary] = useState<number | ''>('');
  const [editExperienceYears, setEditExperienceYears] = useState<number | ''>('');
  const [editEducationLevel, setEditEducationLevel] = useState('');
  const [editInstitutionName, setEditInstitutionName] = useState('');
  const [editProfileLoading, setEditProfileLoading] = useState(false);

  // Add Skill Modal
  const [isAddSkillOpen, setIsAddSkillOpen] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('Databases');
  const [newSkillLevel, setNewSkillLevel] = useState<SkillLevel>('INTERMEDIATE');
  const [addSkillLoading, setAddSkillLoading] = useState(false);

  const loadSkillWorkspace = useCallback(async () => {
    setSkillsLoading(true);
    setSkillsError(null);
    setAssessmentsError(null);
    const [skillsResult, assessmentsResult] = await Promise.allSettled([
      api.getCandidateSkills(),
      api.getCandidateSkillAssessments(),
    ]);
    if (skillsResult.status === 'fulfilled') setCandidateSkills(skillsResult.value);
    else setSkillsError(skillsResult.reason instanceof Error ? skillsResult.reason.message : 'Your saved skills could not be loaded.');
    if (assessmentsResult.status === 'fulfilled') setSkillAssessments(assessmentsResult.value);
    else setAssessmentsError(assessmentsResult.reason instanceof Error ? assessmentsResult.reason.message : 'Assessment history could not be loaded.');
    setSkillsLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'skills' && candidateProfile?.id) void loadSkillWorkspace();
  }, [activeTab, candidateProfile?.id, loadSkillWorkspace]);

  // Privacy & Account Management
  const [accountFullName, setAccountFullName] = useState(user?.fullName || '');
  const [accountPhone, setAccountPhone] = useState('');
  const [accountUpdateSuccess, setAccountUpdateSuccess] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadErrors([]);
    const results = await Promise.allSettled([
      api.getApplications(),
      api.getSavedJobs(),
      api.getRecommendedJobs(),
      api.getLearningPath(),
      api.getCandidateMessageThreads()
    ]);

    if (results[0].status === 'fulfilled') setApplications(results[0].value);
    if (results[1].status === 'fulfilled') setSavedJobs(results[1].value);
    if (results[2].status === 'fulfilled') setRecommendedJobs(results[2].value);
    if (results[3].status === 'fulfilled') setLearningPath(results[3].value);
    if (results[4].status === 'fulfilled') setUnreadMessageCount(results[4].value.unreadCount);
    else setUnreadMessageCount(null);

    const sections: DashboardDataSection[] = ['applications', 'saved jobs', 'job recommendations', 'career roadmap', 'messages'];
    setLoadErrors(results.flatMap((result, index) => result.status === 'rejected' ? [sections[index]] : []));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
    if (candidateProfile) {
      setAccountFullName(candidateProfile.fullName || user?.fullName || '');
      setAccountPhone(candidateProfile.phone || '');
      setEditHeadline(candidateProfile.headline || '');
      setEditBio(candidateProfile.bio || '');
      setEditCity(candidateProfile.city || '');
      setEditDesiredRole(candidateProfile.desiredRole || '');
      setEditSalary(candidateProfile.desiredSalaryETB ?? '');
      setEditExperienceYears(candidateProfile.experienceYears ?? '');
      setEditEducationLevel(candidateProfile.educationLevel || '');
      setEditInstitutionName(candidateProfile.institutionName || '');
    }
  }, [candidateProfile, loadData, user?.fullName]);

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditProfileLoading(true);
    try {
      await api.updateCandidateProfile({
        headline: editHeadline,
        bio: editBio,
        city: editCity,
        desiredRole: editDesiredRole,
        desiredSalaryETB: editSalary === '' ? undefined : editSalary,
        experienceYears: editExperienceYears === '' ? undefined : editExperienceYears,
        educationLevel: editEducationLevel,
        institutionName: editInstitutionName
      });
      await refreshCandidate();
      setIsEditProfileOpen(false);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setEditProfileLoading(false);
    }
  };

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    setAddSkillLoading(true);
    setSkillActionError(null);
    try {
      await api.addCandidateSkill(newSkillName.trim(), newSkillCategory, newSkillLevel, newSkillYears);
      await loadSkillWorkspace();
      await refreshCandidate();
      setIsAddSkillOpen(false);
      setNewSkillName('');
      setNewSkillYears(0);
    } catch (err: any) {
      setSkillActionError(err instanceof Error ? err.message : 'Failed to add skill.');
    } finally {
      setAddSkillLoading(false);
    }
  };

  const handleUpdateSkill = async (skillId: string, updates: { proficiencyLevel?: SkillLevel; yearsExperience?: number }) => {
    setUpdatingSkillId(skillId);
    setSkillActionError(null);
    try {
      await api.updateCandidateSkill(skillId, updates);
      await loadSkillWorkspace();
      await refreshCandidate();
    } catch (err) {
      setSkillActionError(err instanceof Error ? err.message : 'The skill could not be updated.');
    } finally {
      setUpdatingSkillId(null);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (!confirm('Remove this competency from your profile?')) return;
    setRemovingSkillId(skillId);
    setSkillActionError(null);
    try {
      await api.removeCandidateSkill(skillId);
      await loadSkillWorkspace();
      await refreshCandidate();
    } catch (err: any) {
      setSkillActionError(err instanceof Error ? err.message : 'The skill could not be removed.');
    } finally {
      setRemovingSkillId(null);
    }
  };

  const handleStartAssessment = async (skill: JobSeekerSkill) => {
    setAssessmentSkill(skill);
    setAssessmentQuestions([]);
    setAssessmentAnswers({});
    setAssessmentResult(null);
    setAssessmentError(null);
    setAssessmentLoading(true);
    try {
      setAssessmentQuestions(await api.getCandidateSkillAssessmentQuestions(skill.id));
    } catch (error) {
      setAssessmentError(error instanceof Error ? error.message : 'Assessment questions could not be loaded.');
    } finally {
      setAssessmentLoading(false);
    }
  };

  const handleSubmitAssessment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assessmentSkill || assessmentQuestions.length === 0) return;
    if (assessmentQuestions.some((question) => assessmentAnswers[question.id] === undefined)) {
      setAssessmentError('Answer every question before submitting.');
      return;
    }
    setAssessmentSubmitting(true);
    setAssessmentError(null);
    try {
      const result = await api.submitCandidateSkillAssessment(
        assessmentSkill.id,
        assessmentQuestions.map((question) => ({ questionId: question.id, selectedOption: assessmentAnswers[question.id] })),
      );
      setAssessmentResult(result);
      await loadSkillWorkspace();
      await refreshCandidate();
    } catch (error) {
      setAssessmentError(error instanceof Error ? error.message : 'Your assessment could not be submitted.');
    } finally {
      setAssessmentSubmitting(false);
    }
  };

  const handleUnsave = async (jobId: string) => {
    setSavingJobIds((ids) => [...ids, jobId]);
    try {
      await api.unsaveJob(jobId);
      setSavedJobs(prev => prev.filter(j => j.id !== jobId));
    } catch (err: any) {
      alert(`Failed to unsave: ${err.message}`);
    } finally {
      setSavingJobIds((ids) => ids.filter((id) => id !== jobId));
    }
  };

  const handleSaveJob = async (jobId: string) => {
    setSavingJobIds((ids) => [...ids, jobId]);
    try {
      await api.saveJob(jobId);
      const matchedJob = recommendedJobs.find((job) => job.id === jobId);
      if (matchedJob) {
        setSavedJobs((current) => current.some((job) => job.id === jobId) ? current : [matchedJob, ...current]);
      }
      try {
        setSavedJobs(await api.getSavedJobs());
        setLoadErrors((sections) => sections.filter((section) => section !== 'saved jobs'));
      } catch {
        setLoadErrors((sections) => sections.includes('saved jobs') ? sections : [...sections, 'saved jobs']);
        alert('The job was saved, but your saved-jobs list could not be refreshed. Retry loading to confirm the current list.');
      }
    } catch (err) {
      alert(`Failed to save job: ${err instanceof Error ? err.message : 'Please try again.'}`);
    } finally {
      setSavingJobIds((ids) => ids.filter((id) => id !== jobId));
    }
  };

  const handleToggleMilestone = (step: number) => {
    if (!candidateProfile) return;
    const updated = { ...completedMilestones, [step]: !completedMilestones[step] };
    try {
      localStorage.setItem(`skillbridge_milestones_completed_${candidateProfile.id}`, JSON.stringify(updated));
      setCompletedMilestones(updated);
      setMilestoneStorageError(null);
    } catch {
      setMilestoneStorageError('Roadmap progress could not be saved in this browser; the checkmark was not changed.');
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.updateUserAccount({ fullName: accountFullName, phone: accountPhone });
      setAccountUpdateSuccess(true);
      setTimeout(() => setAccountUpdateSuccess(false), 3000);
      await refreshCandidate();
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) return;
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await api.deleteUserAccount(deletePassword);
      await logout();
      onNavigate('jobs');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  const savedJobIds = new Set(savedJobs.map((job) => job.id));
  const availableRecommendedJobs = recommendedJobs.filter((job) => !isJobUnavailable(job));

  const profileRequirements = useMemo(() => [
    { label: 'Professional headline', complete: Boolean(candidateProfile?.headline?.trim()) },
    { label: 'Professional summary', complete: Boolean(candidateProfile?.bio?.trim()) },
    { label: 'Desired role', complete: Boolean(candidateProfile?.desiredRole?.trim()) },
    { label: 'Education', complete: Boolean(candidateProfile?.educationLevel?.trim() || candidateProfile?.institutionName?.trim()) },
    { label: 'Skills', complete: Boolean(candidateProfile?.skills?.length) },
    { label: 'Location', complete: Boolean(candidateProfile?.city?.trim()) },
  ], [candidateProfile]);
  const completedProfileRequirements = profileRequirements.filter((item) => item.complete).length;
  const profileCompletion = candidateProfile
    ? Math.round((completedProfileRequirements / profileRequirements.length) * 100)
    : null;
  const missingProfileRequirements = profileRequirements.filter((item) => !item.complete);
  const uniqueRecommendations = availableRecommendedJobs.filter((job, index, jobs) =>
    jobs.findIndex((candidate) => candidate.id === job.id) === index
  ).sort((left, right) => (right.compatibilityScore || 0) - (left.compatibilityScore || 0));
  const dashboardRecommendations = uniqueRecommendations.slice(0, 5);
  const dashboardSkillGaps = (learningPath?.priorityGaps || []).slice(0, 4);
  const nextRoadmapMilestone = [...(learningPath?.roadmapMilestones || [])]
    .sort((left, right) => left.step - right.step)
    .find((milestone) => !completedMilestones[milestone.step]);
  const recentApplications = [...applications].sort((left, right) =>
    new Date(right.appliedAt).getTime() - new Date(left.appliedAt).getTime()
  ).slice(0, 3);
  const filteredApplications = applications.filter((application) => {
    const query = applicationQuery.trim().toLowerCase();
    const matchesQuery = !query || `${application.jobTitle} ${application.employerName}`.toLowerCase().includes(query);
    return matchesQuery && (applicationStatusFilter === 'ALL' || application.status === applicationStatusFilter);
  });
  const filteredSavedJobs = savedJobs.filter((job) =>
    `${job.title} ${job.employerName} ${job.city}`.toLowerCase().includes(savedQuery.trim().toLowerCase())
  );
  const filteredSkills = candidateSkills.filter((skill) =>
    `${skill.skillName} ${skill.category} ${skill.proficiencyLevel}`.toLowerCase().includes(skillQuery.trim().toLowerCase())
  );
  const displayName = (candidateProfile?.fullName || user?.fullName || '').trim().split(/\s+/)[0];
  const targetContext = candidateProfile?.city || '';
  const tabHeading: Record<Exclude<JobSeekerTab, 'overview'>, string> = {
    recommendations: 'Recommended jobs',
    applications: 'Applications',
    messages: 'Messages & Opportunities',
    saved: 'Saved jobs',
    skills: 'My skills',
    roadmap: 'Career roadmap',
  };
  const handleTabChange = (tab: string) => {
    if (!isJobSeekerTab(tab)) return;
    setActiveTab(tab);
    onNavigate('seeker-dashboard', { tab });
  };
  return (
    <DashboardLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onNavigate={(page) => onNavigate(page)}
        heroBanner={
          <section className="relative isolate min-h-[112px] overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-4 transition-colors duration-200 motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-950 sm:px-6 sm:py-5">
            <CareerParticleField />
            <div className="relative z-10 flex h-full min-h-[72px] flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                {activeTab === 'overview' && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-800 dark:text-cyan-300">Your career workspace</p>}
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                  {activeTab === 'overview'
                    ? displayName ? `Welcome back, ${displayName}.` : 'Your career overview'
                    : tabHeading[activeTab]}
                </h1>
                {activeTab === 'overview' && <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{targetContext ? `${targetContext} · ` : ''}Build momentum toward your next opportunity.</p>}
              </div>
              {activeTab === 'overview' && <button type="button" onClick={() => onNavigate('jobs')} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">
                Explore jobs<ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>}
            </div>
          </section>
        }
      >
        <div className="space-y-4">
          {loadErrors.length > 0 && (
            <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
              <span>Some dashboard information could not be loaded ({loadErrors.join(', ')}). Please retry.</span>
              <button onClick={() => void loadData()} className="min-h-[44px] rounded-lg border border-amber-400 px-4 font-semibold hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/40">
                Retry loading
              </button>
            </div>
          )}

          {activeTab === 'overview' && <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Career dashboard statistics">
            {[
              { label: 'Recommended jobs', value: loadErrors.includes('job recommendations') ? '—' : new Set(availableRecommendedJobs.map((job) => job.id)).size, context: loadErrors.includes('job recommendations') ? 'Unavailable right now' : availableRecommendedJobs.length ? 'Active matches for your profile' : 'No active matches yet', tab: 'recommendations', icon: Sparkles },
              { label: 'Applications', value: loadErrors.includes('applications') ? '—' : applications.length, context: loadErrors.includes('applications') ? 'Unable to load applications' : applications.length === 1 ? 'Application submitted' : 'Total submitted', tab: 'applications', icon: Briefcase },
              { label: 'Saved jobs', value: loadErrors.includes('saved jobs') ? '—' : savedJobs.length, context: loadErrors.includes('saved jobs') ? 'Unable to load saved jobs' : savedJobs.length ? 'Keep opportunities close' : 'Save roles to revisit', tab: 'saved', icon: Bookmark },
              { label: 'Profile completion', value: profileCompletion === null ? '—' : `${profileCompletion}%`, context: profileCompletion === null ? 'Profile unavailable' : missingProfileRequirements.length ? `${missingProfileRequirements.length} details to complete` : 'Key details are in place', tab: 'completion', icon: CheckCircle2 },
            ].map(({ label, value, context, tab, icon: Icon }) => (
              <DashboardMetricCard
                key={tab}
                label={label}
                value={loading && tab !== 'completion'
                  ? <span className="block h-7 w-12 animate-pulse rounded bg-slate-200 dark:bg-slate-700" aria-label={`Loading ${label.toLowerCase()}`} />
                  : value}
                detail={tab === 'completion'
                  ? profileCompletion === null
                    ? 'Profile unavailable'
                    : missingProfileRequirements.length
                      ? `Next: ${missingProfileRequirements.slice(0, 2).map((item) => item.label.toLowerCase()).join(' and ')}`
                      : 'Key details are in place'
                  : loading ? 'Loading your information…' : context}
                icon={Icon}
                onClick={() => tab === 'completion' ? setIsEditProfileOpen(true) : handleTabChange(tab)}
                ariaLabel={tab === 'completion' ? `Profile completion ${value}. Complete your profile` : `${label}: ${value}`}
                progress={tab === 'completion' && profileCompletion !== null ? { value: profileCompletion, label: 'Profile completion' } : undefined}
                className="transition-all hover:-translate-y-0.5 sm:p-4"
              />
            ))}
          </section>}

        {activeTab === 'overview' && (
          <section className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)] xl:gap-4">
            <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800 sm:px-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-300">Matched to your profile</p>
                  <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950 dark:text-white">Recommended jobs</h2>
                </div>
                <button type="button" onClick={() => handleTabChange('recommendations')} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-cyan-900 hover:bg-cyan-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-300 dark:hover:bg-cyan-950/40">View recommendations <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
              </div>
              {loading ? (
                <div className="space-y-3 p-5 sm:p-6" role="status" aria-label="Loading recommended jobs">
                  {[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}
                </div>
              ) : dashboardRecommendations.length ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dashboardRecommendations.map((job: any) => (
                    <article key={job.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/30 sm:px-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-base font-bold tracking-tight text-slate-950 dark:text-white">{job.title}</h3>
                          <p className="mt-1 truncate text-sm font-medium text-slate-700 dark:text-slate-300">{job.employerName}</p>
                        </div>
                        {typeof job.compatibilityScore === 'number' && Number.isFinite(job.compatibilityScore) && <span className="shrink-0 rounded-lg bg-cyan-50 px-2.5 py-1.5 text-xs font-bold tabular-nums text-cyan-900 dark:bg-cyan-950/60 dark:text-cyan-200">{job.compatibilityScore}% fit</span>}
                      </div>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {job.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{job.city}</span>}
                        {job.workplaceType && <span>{String(job.workplaceType).replaceAll('_', ' ').toLowerCase()}</span>}
                        {job.jobType && <span>{String(job.jobType).replaceAll('_', ' ').toLowerCase()}</span>}
                      </p>
                      {job.matchedSkills?.length > 0 && <ul className="flex flex-wrap gap-1.5" aria-label="Matched skills">{job.matchedSkills.slice(0, 3).map((skill: any) => <li key={skill.skill} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{skill.skill}</li>)}</ul>}
                      <div className="flex items-center justify-between gap-3">
                        {job.employerVerified && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />Verified employer</span>}
                        <div className="ml-auto flex shrink-0 items-center gap-2">
                          <button type="button" onClick={() => savedJobIds.has(job.id) ? handleUnsave(job.id) : handleSaveJob(job.id)} disabled={savingJobIds.includes(job.id)} aria-label={savedJobIds.has(job.id) ? `Unsave ${job.title}` : `Save ${job.title}`} aria-pressed={savedJobIds.has(job.id)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-cyan-300 hover:text-cyan-900 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-slate-700 dark:text-slate-200 dark:hover:text-cyan-200">{savingJobIds.includes(job.id) ? 'Saving…' : savedJobIds.has(job.id) ? <><Check className="h-3.5 w-3.5" aria-hidden="true" />Saved</> : <><Bookmark className="h-3.5 w-3.5" aria-hidden="true" />Save</>}</button>
                          <button type="button" onClick={() => onNavigate('job-detail', { jobId: job.id })} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400">View job<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : loadErrors.includes('job recommendations') ? (
                <div className="p-6 sm:p-8" role="alert">
                  <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">Recommendations are unavailable right now.</p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Your match list could not be loaded. Retry the dashboard or browse all open roles.</p>
                  <button type="button" onClick={() => onNavigate('jobs')} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:border-cyan-400 dark:border-slate-700 dark:text-slate-200">Browse jobs<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </div>
              ) : (
                <div className="p-6 sm:p-8">
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200"><Target className="h-5 w-5" aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">No matching active jobs yet</p>
                      <p className="mt-1 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-400">{candidateProfile?.skills?.length ? 'There are no current matches from the active roles reviewed. You can still browse all published jobs.' : 'Add skills to your profile to make future job matches more relevant, or explore current openings.'}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {!candidateProfile?.skills?.length && <button type="button" onClick={() => setIsAddSkillOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-800 hover:border-cyan-400 dark:border-slate-700 dark:text-slate-200">Add skills<Plus className="h-3.5 w-3.5" aria-hidden="true" /></button>}
                        <button type="button" onClick={() => onNavigate('jobs')} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400">Find jobs<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <article className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Your activity</p><h2 className="mt-1 text-base font-bold text-slate-950 dark:text-white">Recent applications</h2></div>
                  <button type="button" onClick={() => handleTabChange('applications')} aria-label="View all applications" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-cyan-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-cyan-300"><ArrowUpRight className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                {loading ? <div className="mt-4 h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" role="status" aria-label="Loading applications" /> : loadErrors.includes('applications') ? (
                  <p className="mt-3 text-sm text-rose-700 dark:text-rose-300" role="alert">Applications could not be loaded. Use Retry loading above.</p>
                ) : recentApplications.length ? (
                  <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                    {recentApplications.map((application) => (
                      <li key={application.id}>
                        <button type="button" onClick={() => onNavigate('job-detail', { jobId: application.jobId })} className="flex min-h-[60px] w-full items-center justify-between gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{application.jobTitle}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{application.employerName} · {new Date(application.appliedAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${applicationStatusClass(application.status)}`}>{applicationStatusLabel[application.status]}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800/60">
                    <p className="text-sm text-slate-600 dark:text-slate-300">No applications yet.</p>
                    <button type="button" onClick={() => onNavigate('jobs')} className="mt-2 min-h-9 text-xs font-semibold text-sky-800 hover:underline dark:text-sky-300">Explore jobs</button>
                  </div>
                )}
              </article>

              <article className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between gap-3">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Keep growing</p><h2 className="mt-1 text-base font-bold text-slate-950 dark:text-white">Career development</h2></div>
                  <button type="button" onClick={() => handleTabChange('skills')} className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-cyan-900 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/40">My skills<ArrowUpRight className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" /></button>
                </div>
                {candidateProfile?.skills?.length ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {candidateProfile.skills.slice(0, 4).map((skill) => <li key={skill.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"><span className="font-medium text-slate-800 dark:text-slate-100">{skill.skillName}</span><span className="ml-1.5 text-slate-500 dark:text-slate-400">{skill.proficiencyLevel.toLowerCase()}</span></li>)}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Add skills to improve the relevance of your job matches.</p>
                )}
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Skills requested by active jobs</p>
                  {loading ? <div className="mt-2 h-7 animate-pulse rounded bg-slate-100 dark:bg-slate-800" role="status" aria-label="Loading skill gaps" /> : dashboardSkillGaps.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">{dashboardSkillGaps.map((gap: any) => <span key={gap.skill} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{gap.skill}</span>)}<span className="w-full text-[11px] text-slate-500 dark:text-slate-400">Personalized from active job requirements, not a formal assessment.</span></div>
                  ) : (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {loadErrors.includes('career roadmap')
                        ? 'Skill-gap suggestions are temporarily unavailable. Retry loading to check again.'
                        : learningPath?.totalOpenRolesAnalyzed > 0
                          ? `No skill gaps identified across ${learningPath.totalOpenRolesAnalyzed} active ${learningPath.totalOpenRolesAnalyzed === 1 ? 'role' : 'roles'} reviewed.`
                          : 'Recommendations will appear when active job requirements are available.'}
                    </p>
                  )}
                </div>
                {nextRoadmapMilestone && (
                  <button type="button" onClick={() => handleTabChange('roadmap')} className="mt-3 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-left hover:border-cyan-300 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-cyan-900">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Next roadmap step</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">{nextRoadmapMilestone.skillName}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Recommended from {nextRoadmapMilestone.frequencyInOpenJobs} active {nextRoadmapMilestone.frequencyInOpenJobs === 1 ? 'job' : 'jobs'} reviewed
                    </p>
                  </button>
                )}
                {!nextRoadmapMilestone && (
                  <button type="button" onClick={() => handleTabChange('roadmap')} className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-cyan-400 dark:border-slate-700 dark:text-slate-200">Open career roadmap<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
                )}
              </article>
              <button type="button" onClick={() => handleTabChange('messages')} className="group flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 text-left hover:border-cyan-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-cyan-900 sm:col-span-2 lg:col-span-1">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300"><Mail className="h-5 w-5" aria-hidden="true" /></span>
                  <span className="min-w-0"><span className="block text-sm font-bold text-slate-950 dark:text-white">Messages &amp; opportunities</span><span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{loadErrors.includes('messages') ? 'Unread count unavailable' : unreadMessageCount === null ? 'Loading unread messages…' : unreadMessageCount === 0 ? 'You’re all caught up' : `${unreadMessageCount} unread ${unreadMessageCount === 1 ? 'message' : 'messages'}`}</span></span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-700 dark:group-hover:text-cyan-300" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* Skill- and experience-based job recommendations */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            {/* Ethical Notice Banner */}
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl flex items-start gap-3 text-xs text-sky-950">
              <Info className="w-4 h-4 text-sky-700 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <div className="font-bold">Explainable Algorithmic Fit & Fair Matching</div>
                <p className="text-sky-900 leading-relaxed">
                  Compatibility scores compare skills and proficiency levels recorded on your profile (70% weight) with stated experience (30% weight). Skills are only described as verified when the platform has verification evidence. Sensitive personal attributes are excluded. Scores indicate requirement alignment, not a hiring probability or guarantee, and do not automatically reject candidates.
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900" role="status">Loading your recommendations…</div>
            ) : loadErrors.includes('job recommendations') ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
                Recommendations are unavailable. Use Retry loading above; no empty result is assumed.
              </div>
            ) : uniqueRecommendations.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors p-8 text-center space-y-3">
                <Target className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-bold text-slate-800 text-sm">No Recommendations Available Yet</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Add more competencies to your demonstrated skill matrix or browse active job postings to generate personalized matches.
                </p>
                <button
                  onClick={() => setIsAddSkillOpen(true)}
                  className="px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-semibold hover:bg-sky-700"
                >
                  Add Skills to Profile
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {uniqueRecommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors p-6 space-y-4 hover:border-slate-300 transition-all shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">{rec.employerName}</span>
                          {rec.employerVerified && (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                              Verified Org
                            </span>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{rec.city} ({rec.workplaceType})</span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-950 dark:text-white font-heading mt-1">
                          {rec.title}
                        </h3>

                        <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                          {rec.recommendationReason}
                        </p>
                      </div>

                      {/* Compatibility Badge & Breakdown */}
                      <div className="flex sm:flex-col items-center sm:items-end gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className={`text-2xl font-extrabold font-heading ${
                            rec.compatibilityScore >= 75 ? 'text-emerald-700' : (rec.compatibilityScore >= 50 ? 'text-sky-700' : 'text-amber-700')
                          }`}>
                            {rec.compatibilityScore}%
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">Compatibility Score</div>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rec.experienceAlignment?.status === 'EXCEEDS' 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : (rec.experienceAlignment?.status === 'MEETS' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800')
                        }`}>
                          Exp: {rec.experienceAlignment?.status || 'ALIGNED'}
                        </span>
                      </div>
                    </div>

                    {/* Skill Alignment Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
                      <div>
                        <span className="font-semibold text-slate-700 block mb-1.5">
                          Matched Skills ({rec.matchedSkillsCount || 0}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.matchedSkills && rec.matchedSkills.length > 0 ? (
                            rec.matchedSkills.map((m: any) => (
                              <span key={m.skill} className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>{m.skill}</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-[11px]">No direct skill matches registered.</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <span className="font-semibold text-slate-700 block mb-1.5">
                          Identified Gaps ({rec.missingSkillsCount || 0}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rec.missingSkills && rec.missingSkills.length > 0 ? (
                            rec.missingSkills.slice(0, 3).map((gap: any) => (
                              <span key={gap.skill} className={`px-2 py-0.5 rounded text-[11px] border ${
                                gap.isMandatory 
                                  ? 'bg-rose-50 text-rose-800 border-rose-200 font-semibold' 
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {gap.skill} {gap.isMandatory && '(Req)'}
                              </span>
                            ))
                          ) : (
                            <span className="text-emerald-700 font-medium text-[11px]">All required skills satisfied!</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-[11px] text-slate-400 font-mono">
                        {rec.scoringBreakdown?.formula || 'Score = (Skills × 0.7) + (Exp × 0.3)'}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => savedJobIds.has(rec.id) ? handleUnsave(rec.id) : handleSaveJob(rec.id)}
                          disabled={savingJobIds.includes(rec.id)}
                          aria-pressed={savedJobIds.has(rec.id)}
                          className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {savingJobIds.includes(rec.id) ? 'Saving…' : savedJobIds.has(rec.id) ? 'Saved' : 'Save job'}
                        </button>
                        <button
                          onClick={() => onNavigate('job-detail', { jobId: rec.id })}
                          className="min-h-[44px] rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                        >
                          View & apply <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Applications Pipeline */}
        {activeTab === 'applications' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors p-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Search applications
                <input value={applicationQuery} onChange={(event) => setApplicationQuery(event.target.value)} placeholder="Job or employer" className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Application status
                <select value={applicationStatusFilter} onChange={(event) => setApplicationStatusFilter(event.target.value)} className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="ALL">All statuses</option>
                  <option value="APPLIED">Applied</option>
                  <option value="SCREENING">Screening</option>
                  <option value="SHORTLISTED">Shortlisted</option>
                  <option value="TECHNICAL_ASSESSMENT">Technical assessment</option>
                  <option value="INTERVIEW_SCHEDULED">Interview scheduled</option>
                  <option value="OFFERED">Offered</option>
                  <option value="HIRED">Hired</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                </select>
              </label>
            </div>
            {loading ? (
              <p className="p-8 text-center text-sm text-slate-500" role="status">Loading your applications…</p>
            ) : loadErrors.includes('applications') ? (
              <p className="p-8 text-center text-sm text-rose-700 dark:text-rose-300" role="alert">Applications could not be loaded. Use Retry loading above.</p>
            ) : applications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No applications yet. Browse open jobs to find a suitable role.
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No applications match these filters.</div>
            ) : (
              <div className="space-y-4">
                {filteredApplications.map((app) => (
                  <div
                    key={app.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-800">{app.employerName}</span>
                        <span aria-hidden="true">·</span>
                        <span>Applied {new Date(app.appliedAt).toLocaleDateString()}</span>
                      </div>

                      <h3 className="font-bold text-base text-slate-950 dark:text-white font-heading">
                        {app.jobTitle}
                      </h3>

                      {app.coverNote && (
                        <p className="text-xs text-slate-600 italic">
                          "{app.coverNote}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-4 self-start sm:self-auto">
                      <div className="text-right">
                        <div className="text-sm font-bold text-sky-700 font-mono">
                          {app.matchScore}% Match
                        </div>
                        <div className="text-[10px] text-slate-400">Algorithmic Fit</div>
                      </div>

                      <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-800">
                        Stage: {app.status.replace('_', ' ')}
                      </div>

                      <button
                        onClick={() => onNavigate('job-detail', { jobId: app.jobId })}
                        className="p-2 text-slate-400 hover:text-slate-700"
                        title="View job posting"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Saved Bookmarks */}
        {activeTab === 'messages' && <CandidateMessagesPanel onNavigate={onNavigate} />}

        {activeTab === 'saved' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 transition-colors p-6 space-y-4">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Search saved jobs
              <input value={savedQuery} onChange={(event) => setSavedQuery(event.target.value)} placeholder="Job, employer, or city" className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:max-w-md" />
            </label>
            {loading ? (
              <p className="p-8 text-center text-sm text-slate-500" role="status">Loading your saved jobs…</p>
            ) : loadErrors.includes('saved jobs') ? (
              <p className="p-8 text-center text-sm text-rose-700 dark:text-rose-300" role="alert">Saved jobs could not be loaded. Use Retry loading above.</p>
            ) : savedJobs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No bookmarked jobs yet. Save interesting vacancies from the job search board.
              </div>
            ) : filteredSavedJobs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No saved jobs match your search.</div>
            ) : (
              <div className="space-y-3">
                {filteredSavedJobs.map((job) => (
                  <div
                    key={job.savedId || job.id}
                    className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:flex-row sm:items-center dark:border-slate-700 dark:bg-slate-800/40"
                  >
                    <div>
                      <div className="text-xs text-slate-500">{job.employerName} · {job.city}</div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white font-heading mt-0.5">{job.title}</h4>
                      {isJobUnavailable(job) && (
                        <p className="mt-1 text-xs font-semibold text-amber-700 dark:text-amber-400">No longer accepting applications</p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onNavigate('job-detail', { jobId: job.id })}
                        className="min-h-[44px] rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                      >
                        {isJobUnavailable(job) ? 'View details' : 'View & Apply'}
                      </button>
                      <button
                        onClick={() => handleUnsave(job.id)}
                        disabled={savingJobIds.includes(job.id)}
                        className="min-h-[44px] px-2 text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'skills' && (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Your skills</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Manage your saved skills and proficiency. Platform assessment results are recorded separately from self-reported experience.</p>
              </div>
              <button onClick={() => setIsAddSkillOpen(true)} className="min-h-[44px] shrink-0 rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500">
                <Plus className="mr-1 inline h-4 w-4" /> Add skill
              </button>
            </div>

            {skillActionError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{skillActionError}</p>}

            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Search skills
              <input value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Skill name, category, or proficiency" className="mt-1.5 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:max-w-md" />
            </label>

            {skillsLoading ? (
              <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900" role="status">Loading your saved skills and assessment history…</p>
            ) : skillsError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
                <span>{skillsError}</span>
                <button type="button" onClick={() => void loadSkillWorkspace()} className="min-h-10 rounded-lg border border-rose-300 px-3 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40">Retry</button>
              </div>
            ) : filteredSkills.length ? (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
                {filteredSkills.map((skill) => (
                  <li key={skill.id} className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-white">{skill.skillName}</h3>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${skill.isVerified ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {skill.isVerified ? 'Platform verified' : 'Self-reported'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{skill.category}{skill.verifiedAt ? ` · Verified ${new Date(skill.verifiedAt).toLocaleDateString()}` : ''}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Proficiency
                          <select
                            value={skill.proficiencyLevel}
                            disabled={updatingSkillId === skill.id}
                            onChange={(event) => void handleUpdateSkill(skill.id, { proficiencyLevel: event.target.value as SkillLevel })}
                            className="ml-2 min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            aria-label={`${skill.skillName} proficiency`}
                          >
                            <option value="BEGINNER">Beginner</option>
                            <option value="INTERMEDIATE">Intermediate</option>
                            <option value="ADVANCED">Advanced</option>
                            <option value="EXPERT">Expert</option>
                          </select>
                        </label>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          Years
                          <input
                            type="number"
                            min="0"
                            max="80"
                            step="0.5"
                            defaultValue={skill.yearsExperience}
                            disabled={updatingSkillId === skill.id}
                            onBlur={(event) => {
                              const yearsExperience = Number(event.currentTarget.value);
                              if (Number.isFinite(yearsExperience) && yearsExperience >= 0 && yearsExperience !== skill.yearsExperience) {
                                void handleUpdateSkill(skill.id, { yearsExperience });
                              }
                            }}
                            className="ml-2 min-h-10 w-20 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            aria-label={`${skill.skillName} years of experience`}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                      {(skill.assessmentQuestionCount ?? 0) >= 5 ? (
                        <button type="button" onClick={() => void handleStartAssessment(skill)} className="min-h-9 rounded-lg bg-cyan-800 px-3 text-xs font-semibold text-white hover:bg-cyan-700 dark:bg-cyan-700 dark:hover:bg-cyan-600">Take skill assessment</button>
                      ) : (
                        <span className="text-xs text-slate-500 dark:text-slate-400">No platform assessment is available for this skill yet.</span>
                      )}
                      <button type="button" disabled={removingSkillId === skill.id} onClick={() => void handleRemoveSkill(skill.id)} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:text-rose-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:text-rose-300">
                        {removingSkillId === skill.id ? 'Removing…' : 'Remove skill'}
                      </button>
                    </div>
                    {assessmentsError ? (
                      <p className="text-xs text-rose-700 dark:text-rose-300" role="alert">{assessmentsError}</p>
                    ) : skillAssessments.filter((attempt) => attempt.skillId === skill.skillId).length > 0 && (
                      <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Assessment history</p>
                        <ul className="mt-2 space-y-1.5">
                          {skillAssessments.filter((attempt) => attempt.skillId === skill.skillId).map((attempt) => (
                            <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                              <span>{new Date(attempt.completedAt).toLocaleString()} · {attempt.levelAchieved.toLowerCase()}</span>
                              <span className="font-semibold">{attempt.scorePercentage}% ({attempt.questionsCount} questions)</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : candidateSkills.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                <Award className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">No matching skills</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Try another search term.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                <Award className="mx-auto h-8 w-8 text-slate-400" />
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">Your skills list is empty</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Add skills you can demonstrate to improve the relevance of job matches.</p>
                <button onClick={() => setIsAddSkillOpen(true)} className="mt-4 min-h-[44px] rounded-lg bg-sky-700 px-4 text-sm font-semibold text-white hover:bg-sky-800 dark:bg-sky-600">Add your first skill</button>
              </div>
            )}

            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
              <strong>Assessment verification:</strong> platform verification is awarded only after a recorded assessment score of at least 80%. Self-reported proficiency does not create a verification badge.
            </div>
          </section>
        )}

        {/* Tab 4: Career Skill Roadmap & Progress Tracker */}
        {activeTab === 'roadmap' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Career roadmap</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                  {learningPath?.targetRole || candidateProfile?.desiredRole || 'Your role focus'}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Completion checkmarks are stored in this browser only and are not synced to your account.</p>
                {milestoneStorageError && <p className="mt-1 text-xs text-rose-700 dark:text-rose-300" role="alert">{milestoneStorageError}</p>}
              </div>
              <button type="button" onClick={() => onNavigate('jobs')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                Find jobs
              </button>
            </div>

            {loading ? (
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400" role="status">Checking active job requirements for skill gaps…</div>
            ) : loadErrors.includes('career roadmap') ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">Career recommendations could not be loaded. Use Retry loading above.</div>
            ) : learningPath?.roadmapMilestones && learningPath.roadmapMilestones.length > 0 ? (
              <div className="space-y-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Rule-based skill suggestions from {learningPath.totalOpenRolesAnalyzed} active {learningPath.totalOpenRolesAnalyzed === 1 ? 'job' : 'jobs'} analyzed. These are not verified course recommendations or formal assessment results.
                </p>
                {learningPath.roadmapMilestones.map((m: any) => {
                  const isDone = !!completedMilestones[m.step];
                  return (
                    <div key={m.step} className={`rounded-xl border p-4 transition-all ${isDone ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20' : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={isDone} onChange={() => handleToggleMilestone(m.step)} aria-label={`${isDone ? 'Unmark' : 'Mark'} ${m.skillName} as complete`} className="mt-1 h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500" />
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white">Milestone {m.step}: {m.skillName}</span>
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{m.category}</span>
                              {m.isMandatoryInRoles && (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Required by some jobs</span>
                              )}
                            </div>
                            <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">Listed in {m.frequencyInOpenJobs} active {m.frequencyInOpenJobs === 1 ? 'job' : 'jobs'} reviewed.</p>
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="font-medium">{isDone ? 'Marked complete' : 'Not started'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                    <Target className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No skill-gap recommendations yet</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-600 dark:text-slate-300">
                      {learningPath?.totalOpenRolesAnalyzed > 0
                        ? `The active roles we reviewed do not show a clear skill gap for ${candidateProfile?.desiredRole || 'your current target role'} right now.`
                        : 'There are not enough active job requirements to generate targeted recommendations yet.'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 sm:pl-12">
                  <button type="button" onClick={() => onNavigate('jobs')} className="min-h-10 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">Find Jobs</button>
                  <button type="button" onClick={() => handleTabChange('skills')} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Manage My Skills</button>
                  <button type="button" onClick={() => onNavigate('ai-nexus')} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">AI Nexus</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Edit Candidate Profile</h3>
              <button onClick={() => setIsEditProfileOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleEditProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Professional Headline</label>
                <input
                  type="text"
                  required
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  placeholder="e.g. Full-Stack Software Engineer & Distributed Systems Enthusiast"
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Professional Summary / Bio</label>
                <textarea
                  rows={3}
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City in Ethiopia</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Desired Monthly Salary (ETB)</label>
                  <input
                    type="number"
                    min="0"
                    value={editSalary}
                    onChange={(e) => setEditSalary(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Years of experience</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editExperienceYears}
                    onChange={(e) => setEditExperienceYears(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Education level</label>
                  <input
                    type="text"
                    maxLength={120}
                    value={editEducationLevel}
                    onChange={(e) => setEditEducationLevel(e.target.value)}
                    placeholder="e.g. B.Sc. in Computer Science"
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Institution</label>
                  <input
                    type="text"
                    maxLength={160}
                    value={editInstitutionName}
                    onChange={(e) => setEditInstitutionName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editProfileLoading}
                  className="px-5 py-2 font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
                >
                  {editProfileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Skill Modal */}
      {isAddSkillOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Add Technical Competency</h3>
              <button onClick={() => setIsAddSkillOpen(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <form onSubmit={handleAddSkill} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Technology Name</label>
                <input
                  type="text"
                  required
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g. Docker, Redis, FastAPI, Go"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                >
                  <option value="Databases">Databases (PostgreSQL, Redis)</option>
                  <option value="Frontend">Frontend (React, Vue, Tailwind)</option>
                  <option value="Backend">Backend (Node.js, Express, FastAPI)</option>
                  <option value="Languages">Languages (TypeScript, Python, Go)</option>
                  <option value="DevOps">DevOps & Cloud (Docker, CI/CD)</option>
                  <option value="Security">Security & Compliance</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Self-Assessed Proficiency</label>
                <select
                  value={newSkillLevel}
                  onChange={(e) => setNewSkillLevel(e.target.value as SkillLevel)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                >
                  <option value="BEGINNER">Beginner (Foundational comprehension)</option>
                  <option value="INTERMEDIATE">Intermediate (Production features implemented)</option>
                  <option value="ADVANCED">Advanced (Architecture & performance tuning)</option>
                  <option value="EXPERT">Expert (Domain authority & core contributor)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Years of experience</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  step="0.5"
                  value={newSkillYears}
                  onChange={(event) => setNewSkillYears(Number(event.target.value))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              {skillActionError && <p className="text-xs text-rose-700 dark:text-rose-300" role="alert">{skillActionError}</p>}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSkillOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSkillLoading}
                  className="px-4 py-2 font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer"
                >
                  {addSkillLoading ? 'Saving...' : 'Add to Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assessmentSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="skill-assessment-title">
          <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:p-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">Platform skill assessment</p>
                <h2 id="skill-assessment-title" className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{assessmentSkill.skillName}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your result and answers are saved to your account. A score of 80% or higher verifies this skill.</p>
              </div>
              <button type="button" onClick={() => setAssessmentSkill(null)} className="min-h-9 min-w-9 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close assessment">✕</button>
            </div>

            {assessmentLoading ? (
              <p className="py-10 text-center text-sm text-slate-500" role="status">Loading assessment questions…</p>
            ) : assessmentError && assessmentQuestions.length === 0 ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{assessmentError}</div>
            ) : assessmentResult ? (
              <div className="py-6">
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-5 text-center dark:border-cyan-900 dark:bg-cyan-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">Assessment result</p>
                  <p className="mt-2 text-4xl font-bold text-slate-950 dark:text-white">{assessmentResult.scorePercentage}%</p>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{assessmentResult.correctCount} of {assessmentResult.questionsCount} correct · {assessmentResult.levelAchieved.toLowerCase()}</p>
                  <p className="mt-3 text-sm font-semibold text-cyan-900 dark:text-cyan-200">
                    {assessmentResult.verified ? 'This skill is now platform verified.' : 'This result did not meet the 80% verification threshold. You may retry the assessment.'}
                  </p>
                </div>
                <button type="button" onClick={() => setAssessmentSkill(null)} className="mt-4 min-h-10 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white">Done</button>
              </div>
            ) : assessmentQuestions.length > 0 ? (
              <form onSubmit={handleSubmitAssessment} className="mt-4 space-y-5">
                {assessmentError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{assessmentError}</p>}
                {assessmentQuestions.map((question, index) => (
                  <fieldset key={question.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <legend className="px-1 text-sm font-semibold text-slate-900 dark:text-white">{index + 1}. {question.prompt}</legend>
                    <div className="mt-3 space-y-2">
                      {question.options.map((option, optionIndex) => (
                        <label key={optionIndex} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                          <input
                            type="radio"
                            name={`assessment-${question.id}`}
                            value={optionIndex}
                            checked={assessmentAnswers[question.id] === optionIndex}
                            onChange={() => setAssessmentAnswers((answers) => ({ ...answers, [question.id]: optionIndex }))}
                            className="mt-0.5 accent-cyan-700"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <button type="submit" disabled={assessmentSubmitting} className="min-h-11 w-full rounded-lg bg-cyan-800 px-4 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60 dark:bg-cyan-700 dark:hover:bg-cyan-600">
                  {assessmentSubmitting ? 'Recording result…' : 'Submit assessment'}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">Confirm Account Deletion</h3>
              </div>
              <button onClick={() => { setIsDeleteModalOpen(false); setDeleteError(''); }} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will permanently erase your user profile, skills, applications, saved jobs, and account records. Please enter your account password to authorize permanent deletion.
            </p>

            {deleteError && (
              <div className="p-2.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-lg text-xs font-semibold">
                {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsDeleteModalOpen(false); setDeleteError(''); }}
                  className="px-3 py-1.5 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading}
                  className="px-4 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deleteLoading ? 'Deleting Account...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
  </DashboardLayout>
  );
};
