import React, { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  api,
  type CandidateDiscoveryCandidate,
  type CandidateDiscoveryFilters,
} from '@/src/services/api-client';

interface CandidateDiscoveryPageProps {
  isVerified: boolean;
  isVerificationLoading: boolean;
  verificationUnavailable: boolean;
  onNavigate: (page: string, params?: Record<string, string>) => void;
  onReviewVerification: () => void;
  onRetryVerification: () => void;
}

const cardClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900';
const inputClass = 'mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/15 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

function candidateInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'JS';
}

function CandidateDetails({
  candidate,
  loading,
  error,
  onClose,
  onMessage,
}: {
  candidate: CandidateDiscoveryCandidate | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onMessage: (applicationId: string) => void;
}) {
  useEffect(() => {
    if (!candidate && !loading && !error) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [candidate, error, loading, onClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="candidate-details-title" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:rounded-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-300">Discoverable candidate</p>
            <h2 id="candidate-details-title" className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Candidate profile</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Close candidate profile"><X className="h-5 w-5" /></button>
        </div>
        {loading ? <p className="py-12 text-center text-sm text-slate-500" role="status">Loading candidate profile…</p> : error ? (
          <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{error}</div>
        ) : candidate ? (
          <div className="mt-5 space-y-5">
            <div className="flex items-start gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-base font-bold text-white dark:bg-cyan-400 dark:text-slate-950" aria-hidden="true">{candidateInitials(candidate.fullName)}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-950 dark:text-white">{candidate.fullName}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{candidate.headline || candidate.desiredRole || 'Professional profile'}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>{candidate.experienceYears} {candidate.experienceYears === 1 ? 'year' : 'years'} experience</span>
                  {candidate.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{candidate.city}</span>}
                  {candidate.availableForWork && <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Available for work</span>}
                </div>
              </div>
            </div>

            {candidate.bio && <section><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">About</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">{candidate.bio}</p></section>}
            {candidate.skills.length > 0 && <section><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Skills</h3><ul className="mt-2 flex flex-wrap gap-2">{candidate.skills.map((skill) => <li key={skill.name} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"><span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{skill.name}</span><span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{skill.proficiencyLevel.toLowerCase()}{skill.isVerified ? ' · verified' : ''}</span></li>)}</ul></section>}
            {(candidate.educationLevel || candidate.institutionName) && <section><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Education</h3><p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{[candidate.educationLevel, candidate.institutionName].filter(Boolean).join(' · ')}</p></section>}
            {candidate.gender && <section><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Gender</h3><p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{candidate.gender.startsWith('SELF_DESCRIBED:') ? candidate.gender.slice('SELF_DESCRIBED:'.length) : candidate.gender.replaceAll('_', ' ').toLowerCase()}</p></section>}

            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              {candidate.email && <a href={`mailto:${candidate.email}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-cyan-500 dark:border-slate-700 dark:text-slate-200"><Mail className="h-4 w-4" />Email</a>}
              {candidate.phone && <a href={`tel:${candidate.phone}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-cyan-500 dark:border-slate-700 dark:text-slate-200">Call</a>}
              {candidate.portfolioUrl && <a href={candidate.portfolioUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-cyan-500 dark:border-slate-700 dark:text-slate-200">Portfolio<ExternalLink className="h-3.5 w-3.5" /></a>}
              {candidate.linkedinUrl && <a href={candidate.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-cyan-500 dark:border-slate-700 dark:text-slate-200">LinkedIn<ExternalLink className="h-3.5 w-3.5" /></a>}
              {candidate.githubUrl && <a href={candidate.githubUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-cyan-500 dark:border-slate-700 dark:text-slate-200">GitHub<ExternalLink className="h-3.5 w-3.5" /></a>}
              {candidate.applicationId && <button type="button" onClick={() => onMessage(candidate.applicationId!)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"><Mail className="h-4 w-4" />Open application messages</button>}
            </div>
            {!candidate.applicationId && <p className="text-xs text-slate-500 dark:text-slate-400">Messaging is available through an application conversation. This candidate has no application to your organization.</p>}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export const CandidateDiscoveryPage: React.FC<CandidateDiscoveryPageProps> = ({
  isVerified,
  isVerificationLoading,
  verificationUnavailable,
  onNavigate,
  onReviewVerification,
  onRetryVerification,
}) => {
  const [filters, setFilters] = useState<CandidateDiscoveryFilters>({ page: 1, pageSize: 12, sort: 'relevance' });
  const [query, setQuery] = useState('');
  const [skill, setSkill] = useState('');
  const [location, setLocation] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [availability, setAvailability] = useState('');
  const [sort, setSort] = useState<'relevance' | 'recent' | 'experience'>('relevance');
  const [results, setResults] = useState<Awaited<ReturnType<typeof api.searchEmployerCandidates>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<CandidateDiscoveryCandidate | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVerified) return;
    let active = true;
    setLoading(true);
    setError(null);
    api.searchEmployerCandidates(filters).then((page) => {
      if (active) setResults(page);
    }).catch((failure: unknown) => {
      if (!active) return;
      setResults(null);
      setError(failure instanceof Error ? failure.message : 'Candidate search could not be loaded.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [filters, isVerified]);

  useEffect(() => {
    if (!selectedProfileId) {
      setCandidate(null);
      setDetailError(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    setDetailError(null);
    api.getEmployerCandidateDetails(selectedProfileId).then((profile) => {
      if (active) setCandidate(profile);
    }).catch((failure: unknown) => {
      if (!active) return;
      setCandidate(null);
      setDetailError(failure instanceof Error ? failure.message : 'Candidate profile could not be loaded.');
    }).finally(() => {
      if (active) setDetailLoading(false);
    });
    return () => { active = false; };
  }, [selectedProfileId]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters({
      q: query.trim() || undefined,
      skill: skill.trim() || undefined,
      location: location.trim() || undefined,
      minExperience: minExperience === '' ? undefined : Number(minExperience),
      availability: availability ? availability as 'available' | 'unavailable' : undefined,
      sort,
      page: 1,
      pageSize: 12,
    });
  };

  const clearSearch = () => {
    setQuery('');
    setSkill('');
    setLocation('');
    setMinExperience('');
    setAvailability('');
    setSort('relevance');
    setFilters({ page: 1, pageSize: 12, sort: 'relevance' });
  };

  if (isVerificationLoading) {
    return <section className={cardClass} aria-labelledby="candidate-discovery-title"><p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400" role="status">Checking organization verification before loading any candidate information…</p></section>;
  }

  if (verificationUnavailable) {
    return <section className={cardClass} aria-labelledby="candidate-discovery-title"><div className="mx-auto max-w-xl py-8 text-center"><h2 id="candidate-discovery-title" className="text-lg font-bold text-slate-950 dark:text-white">Verification status unavailable</h2><p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Candidate information remains protected until your organization’s verification can be confirmed.</p><button type="button" onClick={onRetryVerification} className="mt-4 min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold dark:border-slate-700">Retry status check</button></div></section>;
  }

  if (!isVerified) {
    return <section className={cardClass} aria-labelledby="candidate-discovery-title">
      <div className="mx-auto max-w-xl py-8 text-center">
        <ShieldCheck className="mx-auto h-10 w-10 text-amber-600 dark:text-amber-300" aria-hidden="true" />
        <h2 id="candidate-discovery-title" className="mt-4 text-xl font-bold text-slate-950 dark:text-white">Business verification required</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">Candidate discovery is available only to employers whose organization verification has been approved. No candidate information is shown until verification is confirmed.</p>
        <button type="button" onClick={onReviewVerification} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950">Review organization verification<ArrowUpRight className="h-4 w-4" /></button>
      </div>
    </section>;
  }

  return (
    <section className="space-y-5" aria-labelledby="candidate-discovery-title">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-800 dark:text-cyan-300">Verified employer directory</p><h2 id="candidate-discovery-title" className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Candidate discovery</h2><p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">Find professionals who opted into employer discovery. Contact details are shown only when candidates explicitly allow them.</p></div>
        {results && !error && <p className="text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300" aria-live="polite">{results.total.toLocaleString()} {results.total === 1 ? 'candidate' : 'candidates'}</p>}
      </header>

      <form onSubmit={submitSearch} className={`${cardClass} grid gap-4 md:grid-cols-2 xl:grid-cols-3`}>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 md:col-span-2 xl:col-span-3">Search profiles
          <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100} className={`${inputClass} pl-9`} placeholder="Headline, target role, or skill" /></span>
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Skill<input value={skill} onChange={(event) => setSkill(event.target.value)} maxLength={80} className={inputClass} placeholder="e.g. React" /></label>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Location<input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={100} className={inputClass} placeholder="Only candidates sharing location" /></label>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Minimum experience (years)<input type="number" min={0} max={60} step={1} value={minExperience} onChange={(event) => setMinExperience(event.target.value)} className={inputClass} placeholder="Any experience" /></label>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Availability<select value={availability} onChange={(event) => setAvailability(event.target.value)} className={inputClass}><option value="">Any availability</option><option value="available">Available for work</option><option value="unavailable">Not currently available</option></select></label>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sort by<select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} className={inputClass}><option value="relevance">Relevance</option><option value="recent">Recently updated</option><option value="experience">Most experience</option></select></label>
        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-3">
          <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"><Search className="h-4 w-4" />Search candidates</button>
          <button type="button" onClick={clearSearch} disabled={loading} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Clear filters</button>
        </div>
      </form>

      {loading ? <div className={`${cardClass} py-12 text-center text-sm text-slate-500 dark:text-slate-400`} role="status">      <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 animate-pulse" />Searching opt-in candidate profiles…</span></div> : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert"><p className="font-semibold">Candidate search is unavailable.</p><p className="mt-1">{error}</p><button type="button" onClick={() => setFilters((current) => ({ ...current }))} className="mt-3 min-h-10 rounded-lg border border-rose-300 px-3 text-xs font-semibold dark:border-rose-800">Retry search</button></div>
      ) : results?.data.length ? (
        <>
          <div className="grid gap-3 xl:grid-cols-2">
            {results.data.map((profile) => (
              <article key={profile.profileId} className={`${cardClass} flex min-w-0 flex-col`}>
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white dark:bg-slate-700" aria-hidden="true">{candidateInitials(profile.fullName)}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-slate-950 dark:text-white">{profile.fullName}</h3>
                    <p className="mt-0.5 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{profile.headline || profile.desiredRole || 'Professional profile'}</p>
                  </div>
                  {profile.availableForWork && <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">Available</span>}
                </div>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" />{profile.experienceYears} {profile.experienceYears === 1 ? 'year' : 'years'} experience</span>
                  {profile.city && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{profile.city}</span>}
                </div>
                {profile.skills.length > 0 && <ul className="mt-4 flex min-h-7 flex-wrap gap-1.5" aria-label={`Skills for ${profile.fullName}`}>{profile.skills.slice(0, 5).map((candidateSkill) => <li key={candidateSkill.name} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">{candidateSkill.name}{candidateSkill.isVerified ? ' · verified' : ''}</li>)}{profile.skills.length > 5 && <li className="px-1 py-1 text-[11px] text-slate-500">+{profile.skills.length - 5} more</li>}</ul>}
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Candidate opted into discovery</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" onClick={() => setSelectedProfileId(profile.profileId)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-cyan-500 dark:border-slate-700 dark:text-slate-200">View profile<ArrowUpRight className="h-3.5 w-3.5" /></button>
                    {profile.applicationId && <button type="button" onClick={() => onNavigate('employer-dashboard', { section: 'messages', applicationId: profile.applicationId! })} aria-label={`Open messages for ${profile.fullName}`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950" title="Message through existing application"><Mail className="h-4 w-4" /></button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {results.totalPages > 1 && <nav className="flex items-center justify-between gap-3" aria-label="Candidate search pages">
            <button type="button" disabled={results.page <= 1 || loading} onClick={() => setFilters((current) => ({ ...current, page: results.page - 1 }))} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"><ChevronLeft className="h-4 w-4" />Previous</button>
            <p className="text-xs tabular-nums text-slate-600 dark:text-slate-400" aria-live="polite">Page {results.page} of {results.totalPages}</p>
            <button type="button" disabled={results.page >= results.totalPages || loading} onClick={() => setFilters((current) => ({ ...current, page: results.page + 1 }))} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">Next<ChevronRight className="h-4 w-4" /></button>
          </nav>}
        </>
      ) : (
        <div className={`${cardClass} py-10 text-center`}>
          <Search className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
          <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">No discoverable candidates match these filters</h3>
          <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-400">Results include only active, email-verified job seekers who enabled both discovery preferences and allow employer access through their profile visibility settings.</p>
          <button type="button" onClick={clearSearch} className="mt-4 min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">Clear filters</button>
        </div>
      )}

      {selectedProfileId && <CandidateDetails candidate={candidate} loading={detailLoading} error={detailError} onClose={() => setSelectedProfileId(null)} onMessage={(applicationId) => onNavigate('employer-dashboard', { section: 'messages', applicationId })} />}
    </section>
  );
};
