import React, { useState, useEffect } from 'react';
import { Job, SkillGapAnalysisResult, Application } from '@/shared/types';
import { useAuth } from '@/src/app/providers/AuthContext';
import { api } from '@/src/services/api-client';
import { 
  Building2, 
  MapPin, 
  Briefcase, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Send, 
  ShieldCheck, 
  TrendingUp, 
  Layers,
  ChevronRight,
  Clock,
  BookOpen,
  RefreshCw,
  Bookmark,
} from 'lucide-react';
import { BackButton } from '@/src/components/navigation/BackButton';

interface JobDetailsPageProps {
  jobId: string;
  onNavigate: (page: string, params?: any) => void;
}

export const JobDetailsPage: React.FC<JobDetailsPageProps> = ({ jobId, onNavigate }) => {
  const { user, role, candidateProfile, refreshCandidate, isLoading: authLoading } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [gapAnalysis, setGapAnalysis] = useState<SkillGapAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Application modal state
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [coverNote, setCoverNote] = useState('');
  const [applyLoading, setApplyLoading] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // AI Advisor state
  const [aiAdvisorLoading, setAiAdvisorLoading] = useState(false);
  const [aiRoadmap, setAiRoadmap] = useState<any | null>(null);
  const [aiAdvisorError, setAiAdvisorError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const fetchJobAndAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const jobData = await api.getJobById(jobId);
        setJob(jobData);

        if (user && role === 'JOB_SEEKER') {
          const [gapData, apps] = await Promise.all([
            api.analyzeSkillGap(jobId),
            api.getApplications()
          ]);
          setGapAnalysis(gapData);
          setHasApplied(apps.some((application: Application) => application.jobId === jobId));
          try {
            const savedJobs = await api.getSavedJobs();
            setIsSaved(savedJobs.some((savedJob) => savedJob.id === jobId));
          } catch (savedJobsError) {
            setSaveError(savedJobsError instanceof Error ? savedJobsError.message : 'Saved job status could not be loaded.');
          }
        } else {
          setGapAnalysis(null);
          setHasApplied(false);
          setIsSaved(false);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load job details');
      } finally {
        setLoading(false);
      }
    };

    fetchJobAndAnalysis();
  }, [authLoading, jobId, role, user]);

  const handleApply = async () => {
    if (!job) return;
    setApplyLoading(true);
    try {
      await api.applyForJob(job.id, coverNote);
      setHasApplied(true);
      setIsApplyModalOpen(false);
      await refreshCandidate();
    } catch (err: any) {
      alert(`Application failed: ${err.message}`);
    } finally {
      setApplyLoading(false);
    }
  };

  const handleToggleSave = async () => {
    if (!job) return;
    setSaveLoading(true);
    setSaveError(null);
    try {
      if (isSaved) await api.unsaveJob(job.id);
      else await api.saveJob(job.id);
      setIsSaved(!isSaved);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The saved-job change could not be completed.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleGenerateAiRoadmap = async () => {
    if (!job || !gapAnalysis || !candidateProfile) return;
    setAiAdvisorLoading(true);
    setAiAdvisorError(null);
    try {
      const res = await api.getAISkillAdvisor({
        targetJobTitle: job.title,
        jobId: job.id
      });
      setAiRoadmap({ ...res.data, aiGenerated: res.aiGenerated, provider: res.provider, fallbackUsed: res.fallbackUsed, sourceMessage: res.message });
    } catch (err) {
      setAiAdvisorError(err instanceof Error ? err.message : 'The AI roadmap could not be generated. Please retry.');
    } finally {
      setAiAdvisorLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto py-16 px-4 text-center">
        <div className="animate-spin w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading verified vacancy & calculating skill-gap matrix...</p>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white font-heading">Job Posting Not Found</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">{error || 'Unable to retrieve this vacancy.'}</p>
        <BackButton fallbackTo="/jobs" fallbackLabel="Back to Jobs" />
      </div>
    );
  }

  const matchScore = gapAnalysis?.overallMatchScore || 0;
  const deadline = job.deadline ? new Date(job.deadline) : null;
  deadline?.setHours(23, 59, 59, 999);
  const acceptsApplications = job.status === 'ACTIVE'
    && job.effectiveStatus !== 'EXPIRED'
    && (deadline === null || (Number.isFinite(deadline.getTime()) && deadline.getTime() >= Date.now()));

  return (
    <div className="sb-page mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      
      {/* Back button */}
      <BackButton fallbackTo="/jobs" fallbackLabel="Back to Jobs" />

      {/* 1. Job Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 space-y-6 transition-colors duration-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-3">
            {/* Unboxed Metadata with Typographic Separators */}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                {job.employerName}
              </span>
              <span aria-hidden="true">·</span>
              <span className={`font-medium flex items-center gap-1 ${job.employerVerified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                <ShieldCheck className="w-3.5 h-3.5" />
                {job.employerVerified ? 'Verified employer' : 'Verification pending'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{job.employerIndustry}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 dark:text-white font-heading tracking-tight">
              {job.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {job.city} ({job.workplaceType})
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                {job.jobType.replace('_', ' ')}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Min. {job.minExperienceYears} yrs experience
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {job.salaryMinETB != null && job.salaryMaxETB != null
                  ? `ETB ${job.salaryMinETB.toLocaleString()} - ${job.salaryMaxETB.toLocaleString()} / month`
                  : job.salaryMinETB != null
                    ? `From ETB ${job.salaryMinETB.toLocaleString()} / month`
                    : job.salaryMaxETB != null
                      ? `Up to ETB ${job.salaryMaxETB.toLocaleString()} / month`
                      : job.isSalaryNegotiable
                        ? 'Salary negotiable'
                        : 'Salary not listed'}
              </span>
            </div>
          </div>

          {/* Quick Apply CTA */}
          <div className="flex-shrink-0 flex sm:flex-col items-center gap-3">
            {user && role === 'JOB_SEEKER' ? hasApplied ? (
              <div className="px-5 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Application Submitted</span>
              </div>
            ) : !acceptsApplications ? (
              <div className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold">
                No longer accepting applications
              </div>
            ) : (
              <button
                onClick={() => setIsApplyModalOpen(true)}
                className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Apply with Skill Profile</span>
              </button>
            ) : (
              <button
                onClick={() => onNavigate('auth', { mode: 'login' })}
                className="w-full sm:w-auto px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{user ? 'Sign in as a job seeker to apply' : 'Sign in to apply'}</span>
              </button>
            )}
            {user && role === 'JOB_SEEKER' && (
              <button
                onClick={() => void handleToggleSave()}
                disabled={saveLoading}
                aria-pressed={isSaved}
                className="min-h-[44px] w-full sm:w-auto rounded-lg border border-slate-300 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Bookmark className="mr-1.5 inline h-3.5 w-3.5" />
                {saveLoading ? 'Saving…' : isSaved ? 'Remove from saved jobs' : 'Save job'}
              </button>
            )}
            {saveError && <p className="max-w-48 text-[11px] text-amber-700 dark:text-amber-400" role="status">{saveError}</p>}
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              Deadline: {job.deadline ? new Date(job.deadline).toLocaleDateString() : 'Rolling basis'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Skill-Gap Analysis Card (Central Core Feature) */}
      <div className="bg-slate-900 dark:bg-slate-900/95 text-white rounded-xl border border-slate-800 dark:border-slate-800 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="text-[11px] font-bold text-sky-400 uppercase tracking-wider font-heading">
              Algorithmic Skill Diagnostic
            </div>
            <h2 className="text-xl font-bold font-heading text-white mt-1">
              Your Profile vs. Job Requirements Matrix
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {candidateProfile
                ? <>Evaluated against candidate: <strong className="text-slate-200">{candidateProfile.fullName}</strong> ({candidateProfile.headline})</>
                : 'Personalized matching is available after signing in as a job seeker.'}
            </p>
          </div>

          {gapAnalysis && <div className="flex items-center gap-4 bg-slate-800/80 px-4 py-3 rounded-xl border border-slate-700">
            <div className="text-right">
              <div className="text-2xl font-extrabold text-sky-400 font-heading">
                {matchScore}%
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Weighted Match</div>
            </div>
            <div className="w-12 h-12 rounded-full border-3 border-sky-500/30 flex items-center justify-center">
              <span className={`text-xs font-bold ${matchScore >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {matchScore >= 75 ? 'Strong' : 'Bridgeable'}
              </span>
            </div>
          </div>}
        </div>

        {/* Breakdown: Matched vs. Missing Skills */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          
          {/* Skills Possessed */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Competencies You Hold ({gapAnalysis?.matchedSkills.length ?? '—'})</span>
            </h3>

            <div className="space-y-2">
              {gapAnalysis?.matchedSkills.map((m) => (
                <div key={m.skill} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">{m.skill}</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Your level: {m.candidateLevel} · Required: {m.requiredLevel}
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold ${m.levelRatio >= 1.0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                    {Math.round(m.levelRatio * 100)}% match
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Missing Skills / Gaps */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-wide flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Identified Skill Gaps ({gapAnalysis?.missingSkills.length ?? '—'})</span>
            </h3>

            {gapAnalysis?.missingSkills && gapAnalysis.missingSkills.length > 0 ? (
              <div className="space-y-2">
                {gapAnalysis.missingSkills.map((gap) => (
                  <div key={gap.skill} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{gap.skill}</span>
                        {gap.isMandatory && (
                          <span className="text-[10px] text-rose-400 font-semibold tracking-wide">
                            (Mandatory)
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Target Level: {gap.requiredLevel} · Weight: {gap.weight}/5
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${gap.gapSeverity === 'HIGH' ? 'text-rose-400' : 'text-amber-400'}`}>
                      {gap.gapSeverity} GAP
                    </span>
                  </div>
                ))}
              </div>
            ) : gapAnalysis ? (
              <div className="p-4 rounded-lg bg-slate-800/40 text-slate-300 text-xs">
                No missing skill gaps detected! Your profile satisfies all required competencies.
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-slate-800/40 text-slate-300 text-xs">
                Sign in as a job seeker to compare your skills with this role.
              </div>
            )}
          </div>

        </div>

        {/* AI Career Advisor Trigger */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-400">
            Uses your profile and this active vacancy’s recorded requirements.
          </div>

          {candidateProfile && gapAnalysis ? <button
            onClick={handleGenerateAiRoadmap}
            disabled={aiAdvisorLoading}
            className="w-full sm:w-auto px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-sky-200" />
            <span>{aiAdvisorLoading ? 'Generating roadmap...' : 'Generate AI Upskilling Roadmap'}</span>
          </button> : <span className="text-xs text-slate-400">Sign in as a job seeker for a personalized career roadmap.</span>}
        </div>

        {aiAdvisorError && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-200" role="alert" aria-live="assertive"><AlertCircle className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{aiAdvisorError}</span><button type="button" onClick={() => void handleGenerateAiRoadmap()} disabled={aiAdvisorLoading} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-rose-700 px-3 font-semibold hover:bg-rose-900 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />Retry</button></div>}

        {/* AI Generated Study Plan View */}
        {aiRoadmap && (
          <div className="mt-4 p-5 rounded-xl bg-slate-950 border border-sky-800/50 space-y-4 animate-in fade-in duration-300 text-xs">
            <div className="flex items-center justify-between text-sky-300 border-b border-slate-800 pb-2">
              <span className="font-bold uppercase tracking-wider text-[11px]">
                {aiRoadmap.aiGenerated ? `${aiRoadmap.provider === 'openai' ? 'OpenAI' : 'Gemini'}${aiRoadmap.fallbackUsed ? ' fallback' : ''} Career Diagnostic` : 'Deterministic Career Diagnostic'}
              </span>
              <span className="text-slate-400">Readiness: {aiRoadmap.readinessRating}</span>
            </div>

            <p className="text-slate-200 leading-relaxed">
              {aiRoadmap.summary}
            </p>
            {aiRoadmap.sourceMessage && <p className="text-[11px] text-amber-200">{aiRoadmap.sourceMessage}</p>}

            <div className="text-[11px] text-sky-200 bg-sky-950/70 p-3 rounded-lg border border-sky-900/50">
              <strong>Ethiopian Industry Context:</strong> {aiRoadmap.marketContextEthiopia}
            </div>

            {aiRoadmap.weeklyPlan && (
              <div className="space-y-2 pt-2">
                <div className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                  Targeted 4-Week Action Plan:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {aiRoadmap.weeklyPlan.map((w: any) => (
                    <div key={w.week} className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                      <div className="font-semibold text-sky-300">
                        Week {w.week}: {w.theme}
                      </div>
                      <div className="text-slate-300 text-[11px]">
                        <strong>Project:</strong> {w.practicalProject}
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        <strong>Resources:</strong> {w.recommendedResources?.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* 3. Detailed Job Overview, Responsibilities, and Qualifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Responsibilities & Scope */}
        <div className="lg:col-span-2 space-y-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 transition-colors duration-200 shadow-sm">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-3">
              Role Summary & Engineering Scope
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {job.summary}
            </p>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-3">
              Key Responsibilities
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              {job.responsibilities.map((resp, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400 mt-1.5 flex-shrink-0" />
                  <span className="leading-relaxed">{resp}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-heading mb-3">
              Qualifications & Competence Benchmarks
            </h3>
            <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
              {job.qualifications.map((qual, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 mt-1.5 flex-shrink-0" />
                  <span className="leading-relaxed">{qual}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar: Employer Profile & Internal Review */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 transition-colors duration-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-heading uppercase tracking-wide">
              Employer Profile
            </h3>
            <div className="space-y-2 text-xs">
              <div className="font-bold text-base text-slate-900 dark:text-white">{job.employerName}</div>
              <div className="text-slate-500 dark:text-slate-400">{job.employerIndustry}</div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-slate-500">Job location:</span>
                  <span>{job.city}, Ethiopia</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 dark:text-slate-500">SKILLBRIDGE review:</span>
                  <span className={`font-semibold ${job.employerVerified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                    {job.employerVerified ? 'Approved' : 'Pending'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900 rounded-xl p-5 text-xs space-y-2 text-sky-900 dark:text-sky-200">
            <h4 className="font-bold font-heading text-sky-950 dark:text-sky-100 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-sky-700 dark:text-sky-400" />
              <span>Fair Skill-Based Screening</span>
            </h4>
            <p className="text-sky-800 dark:text-sky-300 leading-relaxed text-[11px]">
              Review the listed requirements and provide accurate skill and experience details with your application. Match information supports discovery and does not guarantee an employment outcome.
            </p>
          </div>
        </div>

      </div>

      {/* 4. Application Submission Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  Submit Skill-Based Application
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">To {job.employerName} · {job.title}</p>
              </div>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs space-y-1 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <div className="font-semibold text-slate-900 dark:text-white">Your Transmitted Skill Profile:</div>
              <div>Candidate: <strong>{candidateProfile?.fullName}</strong></div>
              <div>Calculated Match Score: <strong className="text-sky-700 dark:text-sky-400">{matchScore}%</strong></div>
              <div>Verified Skills: {candidateProfile?.skills.length || 0} documented competencies</div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Cover Note / Technical Portfolio Links
              </label>
              <textarea
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                rows={4}
                placeholder="Mention relevant GitHub repositories, capstone projects, or specific database/framework experience..."
                className="w-full p-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleApply}
                disabled={applyLoading}
                className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                {applyLoading ? 'Submitting Application...' : 'Confirm & Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
