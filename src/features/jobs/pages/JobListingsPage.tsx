import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Job, JobSeekerSkill } from '@/shared/types';
import { getLocationOptions, getLocationMatchValues, normalizeLocationKey } from '@/shared/ethiopiaLocations';
import { useAuth } from '@/src/app/providers/AuthContext';
import { 
  Search, 
  MapPin, 
  Briefcase, 
  Building2, 
  ShieldCheck, 
  SlidersHorizontal, 
  RotateCcw,
  ChevronRight,
  Bookmark
} from 'lucide-react';
import { api } from '@/src/services/api-client';
import { BackButton } from '@/src/components/navigation/BackButton';

interface JobListingsPageProps {
  jobs: Job[];
  onNavigate: (page: string, params?: any) => void;
  initialQuery?: string;
  initialCity?: string;
}

interface JobListViewState {
  searchQuery: string;
  selectedCity: string;
  selectedType: string;
  selectedJobType: string;
  selectedSkill: string;
  minSalary: number;
  sortBy: 'NEWEST' | 'SKILL_OVERLAP';
  page: number;
}

const JOB_LIST_STATE_KEY = 'skillbridge_job_list_view_state';

function restoreJobListState(): Partial<JobListViewState> {
  try {
    const stored = sessionStorage.getItem(JOB_LIST_STATE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Partial<JobListViewState>;
    return {
      ...(typeof parsed.searchQuery === 'string' ? { searchQuery: parsed.searchQuery } : {}),
      ...(typeof parsed.selectedCity === 'string' ? { selectedCity: parsed.selectedCity } : {}),
      ...(typeof parsed.selectedType === 'string' ? { selectedType: parsed.selectedType } : {}),
      ...(typeof parsed.selectedJobType === 'string' ? { selectedJobType: parsed.selectedJobType } : {}),
      ...(typeof parsed.selectedSkill === 'string' ? { selectedSkill: parsed.selectedSkill } : {}),
      ...(typeof parsed.minSalary === 'number' && Number.isFinite(parsed.minSalary) ? { minSalary: parsed.minSalary } : {}),
      ...(parsed.sortBy === 'NEWEST' || parsed.sortBy === 'SKILL_OVERLAP' ? { sortBy: parsed.sortBy } : {}),
      ...(typeof parsed.page === 'number' && Number.isInteger(parsed.page) && parsed.page > 0 ? { page: parsed.page } : {}),
    };
  } catch {
    return {};
  }
}

export const JobListingsPage: React.FC<JobListingsPageProps> = ({ 
  jobs, 
  onNavigate,
  initialQuery = '',
  initialCity = 'All'
}) => {
  const { candidateProfile } = useAuth();
  const [restoredState] = useState(restoreJobListState);
  const skipInitialPageReset = useRef(true);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [savingJobId, setSavingJobId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialQuery || restoredState.searchQuery || '');
  const [selectedCity, setSelectedCity] = useState(initialCity !== 'All' ? initialCity : restoredState.selectedCity || 'All');
  const [locationSearch, setLocationSearch] = useState(selectedCity === 'All' ? '' : selectedCity);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(restoredState.selectedType || 'All');
  const [selectedJobType, setSelectedJobType] = useState(restoredState.selectedJobType || 'All');
  const [selectedSkill, setSelectedSkill] = useState(restoredState.selectedSkill || 'All');
  const [minSalary, setMinSalary] = useState(restoredState.minSalary || 0);
  const [sortBy, setSortBy] = useState<'NEWEST' | 'SKILL_OVERLAP'>(restoredState.sortBy || 'NEWEST');
  const [page, setPage] = useState(restoredState.page || 1);
  const pageSize = 10;

  useEffect(() => {
    if (!candidateProfile) {
      setSavedJobIds([]);
      return;
    }

    let isCurrent = true;
    api.getSavedJobs()
      .then((savedJobs) => {
        if (isCurrent) setSavedJobIds(savedJobs.map((job) => job.id));
      })
      .catch((error: unknown) => {
        if (isCurrent) setSaveError(error instanceof Error ? error.message : 'Saved jobs could not be loaded.');
      });

    return () => {
      isCurrent = false;
    };
  }, [candidateProfile]);

  const toggleSavedJob = async (jobId: string) => {
    setSavingJobId(jobId);
    setSaveError(null);
    try {
      if (savedJobIds.includes(jobId)) {
        await api.unsaveJob(jobId);
        setSavedJobIds((ids) => ids.filter((id) => id !== jobId));
      } else {
        await api.saveJob(jobId);
        setSavedJobIds((ids) => [...ids, jobId]);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'This job could not be saved. Please try again.');
    } finally {
      setSavingJobId(null);
    }
  };

  const locationSuggestions = useMemo(() => {
    const query = locationSearch.trim();
    return [{ id: 'all-location', name: 'All locations', type: 'region' as const }, ...getLocationOptions(query)].filter((option) => option.name !== selectedCity);
  }, [locationSearch, selectedCity]);

  // Available skills filter list
  const availableSkills = ['All', ...new Set(jobs.flatMap((job) => job.skillRequirements.map((requirement) => requirement.skillName)))];

  // Candidate skill map for instant client-side match preview
  const candidateSkills = useMemo(() => {
    return new Set(candidateProfile?.skills.map((s: JobSeekerSkill) => s.skillName.toLowerCase()) || []);
  }, [candidateProfile]);

  // Filtered jobs calculation
  const filteredJobs = useMemo(() => {
    const selectedLocationMatches = selectedCity !== 'All' ? getLocationMatchValues(selectedCity).map((match) => match.toLowerCase()) : null;

    return jobs.filter(job => {
      // Keyword filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = job.title.toLowerCase().includes(q);
        const matchCompany = job.employerName.toLowerCase().includes(q);
        const matchSummary = job.summary.toLowerCase().includes(q);
        const matchSkills = job.skillRequirements.some(s => s.skillName.toLowerCase().includes(q));
        if (!matchTitle && !matchCompany && !matchSummary && !matchSkills) return false;
      }

      // City filter
      if (selectedLocationMatches) {
        const normalizedCity = normalizeLocationKey(job.city || '');
        if (!normalizedCity || !selectedLocationMatches.some((match) => match === normalizedCity || match.includes(normalizedCity) || normalizedCity.includes(match))) {
          return false;
        }
      }

      // Type filter
      if (selectedType !== 'All') {
        if (job.jobType !== selectedType && job.workplaceType.toLowerCase() !== selectedType.toLowerCase()) {
          return false;
        }
      }
      if (selectedJobType !== 'All' && job.jobType !== selectedJobType) return false;

      // Skill filter
      if (selectedSkill !== 'All') {
        const hasSkill = job.skillRequirements.some(
          s => s.skillName.toLowerCase() === selectedSkill.toLowerCase()
        );
        if (!hasSkill) return false;
      }

      // Salary filter
      if (minSalary > 0 && (job.salaryMinETB || 0) < minSalary) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, selectedCity, selectedType, selectedJobType, selectedSkill, minSalary]);

  const sortedJobs = useMemo(() => [...filteredJobs].sort((left, right) => {
    if (sortBy === 'SKILL_OVERLAP') {
      const leftOverlap = left.skillRequirements.filter((requirement) => candidateSkills.has(requirement.skillName.toLowerCase())).length;
      const rightOverlap = right.skillRequirements.filter((requirement) => candidateSkills.has(requirement.skillName.toLowerCase())).length;
      if (rightOverlap !== leftOverlap) return rightOverlap - leftOverlap;
    }
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  }), [filteredJobs, candidateSkills, sortBy]);
  const pageCount = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const visibleJobs = sortedJobs.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (skipInitialPageReset.current) {
      skipInitialPageReset.current = false;
      return;
    }
    setPage(1);
  }, [searchQuery, selectedCity, selectedType, selectedJobType, selectedSkill, minSalary, sortBy]);

  useEffect(() => {
    try {
      sessionStorage.setItem(JOB_LIST_STATE_KEY, JSON.stringify({
        searchQuery, selectedCity, selectedType, selectedJobType, selectedSkill, minSalary, sortBy, page,
      } satisfies JobListViewState));
    } catch {
      // Search remains usable when session storage is unavailable.
    }
  }, [searchQuery, selectedCity, selectedType, selectedJobType, selectedSkill, minSalary, sortBy, page]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCity('All');
    setLocationSearch('');
    setLocationMenuOpen(false);
    setSelectedType('All');
    setSelectedJobType('All');
    setSelectedSkill('All');
    setMinSalary(0);
    setSortBy('NEWEST');
  };

  return (
    <div className="sb-page mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <BackButton fallbackTo="/" fallbackLabel="Back to Home" />

      {/* Header Banner */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider font-heading">
          Opportunity Marketplace
        </div>
        <h1 className="text-3xl font-extrabold text-slate-950 dark:text-white font-heading">
          Skill-Based Job Listings & Matching
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          Explore authentic employment postings across Ethiopian tech hubs. Every vacancy outlines required proficiency levels and deterministic match factors.
        </p>
      </div>

      {/* Main Layout: Filters Sidebar + Results List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Filter Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-5 sticky top-24 transition-colors duration-200 shadow-sm">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="font-bold text-sm text-slate-900 dark:text-white font-heading flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Filter Parameters
              </span>
              <button
                onClick={handleResetFilters}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>

            {/* Keyword Search */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Keyword Search
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Job title, skill, company..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Location in Ethiopia */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Location (Ethiopia)
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={locationSearch || (selectedCity === 'All' ? '' : selectedCity)}
                  placeholder="Search region, city, or town"
                  onFocus={() => setLocationMenuOpen(true)}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLocationSearch(value);
                    setLocationMenuOpen(true);
                    if (!value.trim()) setSelectedCity('All');
                  }}
                  onBlur={() => window.setTimeout(() => setLocationMenuOpen(false), 120)}
                  aria-label="Select a location in Ethiopia"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-900"
                />
                {selectedCity !== 'All' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCity('All');
                      setLocationSearch('');
                      setLocationMenuOpen(false);
                    }}
                    className="absolute right-2 top-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {locationMenuOpen && (
                <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <div className="max-h-72 overflow-y-auto p-1">
                    {locationSuggestions.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">No matching Ethiopian locations.</div>
                    ) : (
                      <ul className="space-y-1">
                        {locationSuggestions.slice(0, 14).map((location) => (
                          <li key={location.id}>
                            <button
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                const nextValue = location.id === 'all-location' ? 'All' : location.name;
                                setSelectedCity(nextValue);
                                setLocationSearch('');
                                setLocationMenuOpen(false);
                              }}
                              className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <span className="font-medium text-slate-800 dark:text-slate-200">{location.name}</span>
                              <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                {location.type === 'region' || location.type === 'city-administration' ? 'Region' : 'Location'}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Workplace / Employment Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Workplace Format
              </label>
              <div className="flex flex-wrap gap-1.5">
                {['All', 'Hybrid', 'On-site', 'Remote'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                      selectedType === type
                        ? 'bg-slate-900 dark:bg-sky-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Required Core Skill */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Core Technology
              </label>
              <div className="flex flex-wrap gap-1.5">
                {availableSkills.map((skill) => (
                  <button
                    key={skill}
                    onClick={() => setSelectedSkill(skill)}
                    className={`px-2.5 py-1 text-xs rounded-md transition-colors cursor-pointer ${
                      selectedSkill === skill
                        ? 'bg-sky-600 text-white font-medium'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Employment type
                <select
                  value={selectedJobType}
                  onChange={(e) => setSelectedJobType(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="All">All types</option>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                </select>
              </label>
            </div>

            {/* Minimum Salary Slider */}
            <div>
              <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span>Minimum Salary:</span>
                <span>{minSalary > 0 ? `${minSalary.toLocaleString()} ETB` : 'Any'}</span>
              </div>
              <input
                type="range"
                min="0"
                max="60000"
                step="5000"
                value={minSalary}
                onChange={(e) => setMinSalary(parseInt(e.target.value, 10))}
                className="w-full accent-sky-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                <span>0 ETB</span>
                <span>60,000+ ETB</span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Job Results Column */}
        <div className="lg:col-span-8 space-y-4">
          
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{filteredJobs.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredJobs.length)} of {filteredJobs.length}</strong> matching vacancies
            </span>
            <label className="flex items-center gap-2">
              Sort by
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <option value="NEWEST">Newest</option>
                <option value="SKILL_OVERLAP">Skills overlap</option>
              </select>
            </label>
            <span className="text-[11px]">
              {candidateProfile ? <>Candidate: <strong className="text-slate-800 dark:text-slate-200">{candidateProfile.fullName}</strong></> : 'Sign in to view personalized recommendations'}
            </span>
          </div>

          {saveError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="status">
              {saveError}
            </div>
          )}

          {filteredJobs.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                No matching vacancies found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Try widening your technology filter, adjusting location, or resetting your search criteria.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            visibleJobs.map((job) => {
              // Quick estimate of matched skills count
              const matchedCount = job.skillRequirements.filter(
                req => candidateSkills.has(req.skillName.toLowerCase())
              ).length;
              return (
                <div
                  key={job.id}
                  className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 hover:shadow-sm transition-all space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      {/* Unboxed Metadata with Typographic Separators */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-900 dark:text-slate-200">{job.employerName}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`${job.employerVerified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'} flex items-center gap-1 font-medium`}>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {job.employerVerified ? 'Verified' : 'Verification pending'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{job.city} ({job.workplaceType})</span>
                      </div>

                      <h2 className="text-xl font-bold text-slate-950 dark:text-white font-heading">
                        {job.title}
                      </h2>
                    </div>

                    {/* Skill overlap preview is not presented as the platform match score. */}
                    <div className="flex items-center gap-2 self-start bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                          {matchedCount} of {job.skillRequirements.length} skills
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">On your profile</div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                    {job.summary}
                  </p>

                  {/* Skills Requirements Matrix */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Specified Skill Requirements:
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700 dark:text-slate-300">
                      {job.skillRequirements.map((req, i) => {
                        const isHeld = candidateSkills.has(req.skillName.toLowerCase());
                        return (
                          <span key={req.id} className="flex items-center gap-1">
                            <span className={isHeld ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-700 dark:text-slate-300'}>
                              {req.skillName} ({req.requiredLevel})
                            </span>
                            {i < job.skillRequirements.length - 1 && (
                              <span className="text-slate-300 dark:text-slate-600 ml-2" aria-hidden="true">·</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer Bar: Salary & View Action */}
                  <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {job.salaryMinETB != null && job.salaryMaxETB != null
                          ? `${job.salaryMinETB.toLocaleString()} - ${job.salaryMaxETB.toLocaleString()} ETB`
                          : job.salaryMinETB != null
                            ? `From ${job.salaryMinETB.toLocaleString()} ETB`
                            : job.salaryMaxETB != null
                              ? `Up to ${job.salaryMaxETB.toLocaleString()} ETB`
                              : job.isSalaryNegotiable ? 'Salary negotiable' : 'Salary not listed'}
                      </div>
                      {job.salaryMinETB != null || job.salaryMaxETB != null || job.isSalaryNegotiable ? (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">Monthly compensation</div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                      {candidateProfile && (
                        <button
                          onClick={() => void toggleSavedJob(job.id)}
                          disabled={savingJobId === job.id}
                          aria-pressed={savedJobIds.includes(job.id)}
                          className="min-h-[44px] rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Bookmark className="mr-1 inline h-3.5 w-3.5" />
                          {savingJobId === job.id ? 'Saving…' : savedJobIds.includes(job.id) ? 'Saved' : 'Save'}
                        </button>
                      )}
                      <button
                        onClick={() => onNavigate('job-detail', { jobId: job.id })}
                        className="min-h-[44px] px-4 bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Analyze Gap & Apply</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {filteredJobs.length > pageSize && (
            <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Job results pages">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300" aria-live="polite">Page {page} of {pageCount}</span>
              <button
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                disabled={page === pageCount}
                className="min-h-[44px] rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                Next
              </button>
            </nav>
          )}

        </div>

      </div>

    </div>
  );
};
