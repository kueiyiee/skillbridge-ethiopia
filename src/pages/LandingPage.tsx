import React, { useState } from 'react';
import { Job } from '@/shared/types';
import { 
  Search, 
  ArrowRight, 
  ArrowUpRight,
  Building2, 
  ShieldCheck, 
  MapPin,
  Briefcase,
  GraduationCap,
  Target
} from 'lucide-react';

interface LandingPageProps {
  jobs: Job[];
  jobsLoading?: boolean;
  jobsError?: string | null;
  onRetryJobs?: () => void;
  searchLoading?: boolean;
  searchError?: string | null;
  onNavigate: (page: string, params?: any) => void;
  onSearch: (params: { q?: string; city?: string }) => void;
}

const cities = ['Addis Ababa', 'Hawassa', 'Dire Dawa', 'Bahir Dar', 'Adama'];

const formatSalaryRange = (job: Job) => {
  if (job.salaryMinETB != null && job.salaryMaxETB != null) {
    return `ETB ${job.salaryMinETB.toLocaleString()} - ${job.salaryMaxETB.toLocaleString()}`;
  }
  if (job.salaryMinETB != null) return `From ETB ${job.salaryMinETB.toLocaleString()}`;
  if (job.salaryMaxETB != null) return `Up to ETB ${job.salaryMaxETB.toLocaleString()}`;
  return job.isSalaryNegotiable ? 'Negotiable' : 'Salary not listed';
};

export const LandingPage: React.FC<LandingPageProps> = ({
  jobs,
  jobsLoading = false,
  jobsError,
  onRetryJobs,
  searchLoading = false,
  searchError,
  onNavigate,
  onSearch
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('All');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({
      q: searchQuery.trim(),
      city: selectedCity === 'All' ? undefined : selectedCity
    });
  };

  const featuredJobs = jobs.slice(0, 3);

  return (
    <div className="space-y-20 pb-20">
      
      {/* Primary introduction and job search */}
      <section className="border-b border-slate-200 bg-slate-50 py-10 transition-colors dark:border-slate-800 dark:bg-slate-950 sm:py-14 lg:py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:gap-14 lg:px-8">
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-sky-800 dark:text-sky-300">
              <span className="h-px w-6 bg-teal-600 dark:bg-teal-400" />
              Skills-first recruitment in Ethiopia
            </div>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-slate-950 dark:text-white font-heading sm:text-5xl lg:text-[3.5rem]">
              Find the right job. Build the right team.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              Discover opportunities and connect with employers who value demonstrated skills, practical experience, and potential.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <button
                onClick={() => onNavigate('jobs')}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600"
              >
                Find a Job <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => onNavigate('employer-dashboard')}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-sky-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-sky-400 dark:hover:bg-slate-800"
              >
                <Building2 className="h-4 w-4 text-teal-700 dark:text-teal-300" aria-hidden="true" />
                Hire Talent
              </button>
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Skills-first matching <span aria-hidden="true">·</span> Employer review <span aria-hidden="true">·</span> Career guidance
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900 sm:p-6">
            <div className="mb-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">Job search</div>
              <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white font-heading">Explore open opportunities</h2>
            </div>
            <form onSubmit={handleSearchSubmit} className="space-y-3.5" aria-busy={searchLoading}>
              <div className="space-y-1.5">
                <label htmlFor="home-job-keyword" className="text-xs font-semibold text-slate-700 dark:text-slate-300">Job title, skill, or keyword</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="home-job-keyword"
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="e.g. React, analyst, engineer"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-700/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="home-job-city" className="text-xs font-semibold text-slate-700 dark:text-slate-300">City or region</label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <select
                    id="home-job-city"
                    value={selectedCity}
                    onChange={(event) => setSelectedCity(event.target.value)}
                    className="min-h-11 w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-900 focus:border-sky-700 focus:outline-none focus:ring-4 focus:ring-sky-700/10 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="All">All locations</option>
                    {cities.map((city) => <option key={city} value={city}>{city}</option>)}
                  </select>
                </div>
              </div>
              {searchError && <p className="text-xs text-rose-700 dark:text-rose-300" role="alert">{searchError}</p>}
              <button
                type="submit"
                disabled={searchLoading}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 disabled:cursor-wait disabled:opacity-70"
              >
                {searchLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                {searchLoading ? 'Searching…' : 'Search Jobs'}
              </button>
            </form>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <div className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">A clear path forward</div>
          <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white font-heading sm:text-3xl">How SKILLBRIDGE works</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"><Target className="h-4 w-4" aria-hidden="true" /></span>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">Showcase your skills</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Build a profile that presents your technical competencies, proficiency levels, and portfolio.</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"><Briefcase className="h-4 w-4" aria-hidden="true" /></span>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">Discover better matches</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Explore opportunities using relevant skills and transparent matching criteria.</p>
          </article>
          <article className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"><GraduationCap className="h-4 w-4" aria-hidden="true" /></span>
            <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">Grow your career</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Use available skill-gap guidance to identify learning priorities and strengthen your capabilities.</p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">Current openings</div>
            <h2 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white font-heading sm:text-3xl">Featured opportunities</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Explore roles that match your skills.</p>
          </div>
          <button
            onClick={() => onNavigate('jobs')}
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-sky-800 transition hover:text-sky-950 dark:text-sky-300 dark:hover:text-sky-200"
          >
            {jobs.length > 0 ? `View all ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}` : 'Browse all jobs'}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {jobsLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Loading opportunities" aria-busy="true">
            {[0, 1, 2].map((item) => <div key={item} className="min-h-52 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800" />)}
          </div>
        ) : jobsError ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 dark:border-rose-900 dark:bg-rose-950/40" role="alert">
            <p className="text-sm text-rose-800 dark:text-rose-200">{jobsError}</p>
            {onRetryJobs && <button onClick={onRetryJobs} className="text-sm font-semibold text-rose-800 underline dark:text-rose-200">Try again</button>}
          </div>
        ) : featuredJobs.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white px-5 py-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <Briefcase className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">No open opportunities right now</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Check back soon or browse all jobs to explore current listings.</p>
            <button onClick={() => onNavigate('jobs')} className="mt-4 text-sm font-semibold text-sky-800 hover:underline dark:text-sky-300">Browse all jobs</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredJobs.map((job) => (
              <article key={job.id} className="flex min-w-0 flex-col rounded-lg border border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-400">{job.employerName}</p>
                    <h3 className="mt-1 text-lg font-bold leading-snug text-slate-950 dark:text-white">{job.title}</h3>
                  </div>
                  {job.employerVerified && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                  {job.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />{job.city}</span>}
                  {job.city && job.workplaceType && <span aria-hidden="true">·</span>}
                  {job.workplaceType && <span>{job.workplaceType}</span>}
                </div>
                <p className="mt-3 min-h-10 text-sm leading-5 text-slate-600 dark:text-slate-300 line-clamp-2">{job.summary}</p>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {job.skillRequirements.slice(0, 3).map((requirement) => (
                    <span key={requirement.id} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">{requirement.skillName}</span>
                  ))}
                  {job.skillRequirements.length > 3 && <span className="self-center text-[11px] text-slate-500 dark:text-slate-400">+{job.skillRequirements.length - 3} more</span>}
                </div>

                <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Salary</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{formatSalaryRange(job)}</div>
                  </div>
                  <button
                    onClick={() => onNavigate('job-detail', { jobId: job.id })}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:bg-sky-700 dark:hover:bg-sky-600"
                  >
                    View Job <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-start sm:p-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"><ShieldCheck className="h-4 w-4" aria-hidden="true" /></span>
          <div>
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">Trust through review and relevant skills</h2>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Active jobs shown here come from employer profiles approved through SKILLBRIDGE’s internal review. Matching focuses on role-related skills and supports discovery; it does not guarantee employment or represent government certification.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 text-center sm:px-6 lg:px-8">
        <div className="rounded-xl border border-app-border bg-app-surface-elevated px-6 py-10 text-app-text-primary shadow-sm sm:px-10 sm:py-12">
          <h2 className="text-2xl font-bold font-heading text-app-text-primary sm:text-3xl">Ready to take your next career step?</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-app-text-secondary">
            Join SKILLBRIDGE to explore opportunities or discover talent through skills-based recruitment.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onNavigate('jobs')}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-app-button-primary-background bg-app-button-primary-background px-5 py-3 text-sm font-semibold text-app-button-primary-foreground transition-colors hover:bg-app-primary-hover hover:border-app-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus"
            >
              Explore Jobs <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => onNavigate('auth', { mode: 'signup' })}
              className="inline-flex min-h-11 items-center rounded-lg border border-app-border-strong bg-app-button-secondary-background px-5 py-3 text-sm font-semibold text-app-button-secondary-foreground transition-colors hover:bg-app-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-focus"
            >
              Create Account
            </button>
          </div>
        </div>
      </section>

    </div>
  );
};
