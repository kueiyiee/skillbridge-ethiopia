import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/src/app/providers/AuthContext';
import { api } from '@/src/services/api-client';
import { Skill } from '@/shared/types';
import { BackButton } from '@/src/components/navigation/BackButton';
import { 
  Sparkles, 
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface CareerSkillsPageProps {
  onNavigate: (page: string, params?: any) => void;
}

export const CareerSkillsPage: React.FC<CareerSkillsPageProps> = ({ onNavigate }) => {
  const { candidateProfile } = useAuth();
  const [skillCatalog, setSkillCatalog] = useState<Skill[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [skillQuery, setSkillQuery] = useState('');
  const [advisorGoal, setAdvisorGoal] = useState(candidateProfile?.desiredRole || '');
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiPlan, setAiPlan] = useState<any | null>(null);
  const [aiPlanError, setAiPlanError] = useState<string | null>(null);

  const loadSkillCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      setSkillCatalog(await api.getSkills());
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'The skills catalog could not be loaded.');
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkillCatalog();
  }, [loadSkillCatalog]);

  const handleConsultAdvisor = async () => {
    if (!candidateProfile || !advisorGoal.trim()) return;
    setLoadingAI(true);
    setAiPlanError(null);
    try {
      const res = await api.getAISkillAdvisor({
        targetJobTitle: advisorGoal
      });
      setAiPlan({ ...res.data, aiGenerated: res.aiGenerated, provider: res.provider, fallbackUsed: res.fallbackUsed, sourceMessage: res.message });
    } catch (err) {
      setAiPlanError(err instanceof Error ? err.message : 'The career plan could not be generated. Please retry.');
    } finally {
      setLoadingAI(false);
    }
  };

  const filteredSkills = skillCatalog.filter((skill) =>
    `${skill.name} ${skill.category} ${skill.description || ''}`.toLowerCase().includes(skillQuery.trim().toLowerCase())
  );

  return (
    <div className="sb-page mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
      <BackButton fallbackTo="/" fallbackLabel="Back to Home" />

      {/* 1. Header */}
      <div className="space-y-2">
        <div className="text-xs font-bold text-sky-700 uppercase tracking-wider font-heading">
          Continuous Career Development
        </div>
        <h1 className="text-3xl font-extrabold text-slate-950 dark:text-white font-heading">
          Skill Taxonomy & AI Upskilling Engine
        </h1>
        <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
          Search the platform skills catalog and generate profile-based career guidance. Catalog availability and AI-generated suggestions are shown separately.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" aria-labelledby="skills-catalog-title">
        <div>
          <h2 id="skills-catalog-title" className="text-xl font-bold text-slate-950 dark:text-white">Platform skills catalog</h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Catalog names, categories, descriptions, and demand ratings are loaded from the backend.</p>
        </div>
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
          Search the catalog
          <input value={skillQuery} onChange={(event) => setSkillQuery(event.target.value)} placeholder="Skill or category" className="mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:max-w-lg" />
        </label>
        {catalogLoading ? (
          <p className="py-6 text-sm text-slate-500" role="status">Loading the skills catalog…</p>
        ) : catalogError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200" role="alert">
            <span>{catalogError}</span>
            <button type="button" onClick={() => void loadSkillCatalog()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-300 px-3 font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40"><RefreshCw className="h-4 w-4" />Retry</button>
          </div>
        ) : filteredSkills.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">{skillCatalog.length === 0 ? 'The backend returned no catalog skills.' : 'No catalog skills match your search.'}</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredSkills.map((skill) => (
              <li key={skill.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{skill.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{skill.category}{skill.description ? ` · ${skill.description}` : ''}</p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-sky-800 dark:text-sky-300">Catalog demand rating: {skill.demandRating}/5</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Interactive AI Career Advisor Workspace */}
      <section className="rounded-xl border border-app-border bg-app-surface p-6 text-app-text shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 border-b border-app-border pb-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 font-heading dark:text-slate-300">
              Intelligent Upskilling Coach
            </div>
            <h2 className="text-xl font-bold font-heading text-slate-950 dark:text-white">
              Personalized Career Plan Generator
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {candidateProfile
                ? `Uses your saved profile (${candidateProfile.skills.length} skills) and target ambition.`
                : 'Sign in as a job seeker to generate a plan from your saved profile.'}
            </p>
          </div>

          <button
            onClick={handleConsultAdvisor}
            disabled={loadingAI || !candidateProfile || !advisorGoal.trim()}
            className="flex items-center gap-2 self-start rounded-lg bg-slate-950 px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white sm:self-auto"
          >
            <Sparkles className="w-4 h-4 text-sky-200" />
            <span>{loadingAI ? 'Generating plan...' : 'Generate 4-Week Study Plan'}</span>
          </button>
        </div>

        <div className="mt-5">
          <label htmlFor="career-goal" className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
            Target role for guidance:
          </label>
          <input
            id="career-goal"
            type="text"
            value={advisorGoal}
            onChange={(e) => setAdvisorGoal(e.target.value)}
            placeholder={candidateProfile?.desiredRole || 'e.g. Backend engineer'}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-600/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-slate-400"
          />
        </div>

        {aiPlanError && <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-200" role="alert" aria-live="assertive"><AlertCircle className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">{aiPlanError}</span><button type="button" onClick={() => void handleConsultAdvisor()} disabled={loadingAI || !candidateProfile} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-rose-700 px-3 font-semibold hover:bg-rose-900 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />Retry</button></div>}

        {aiPlan && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-xs animate-in fade-in duration-300 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-slate-700 dark:border-slate-800 dark:text-slate-200">
              <span className="font-bold text-[11px] uppercase tracking-wider">
                {aiPlan.aiGenerated ? `${aiPlan.provider === 'openai' ? 'OpenAI' : 'Gemini'}${aiPlan.fallbackUsed ? ' fallback' : ''} Career Diagnostic` : 'Deterministic Career Diagnostic'}
              </span>
              <span className="text-slate-600 dark:text-slate-400">Readiness: {aiPlan.readinessRating}</span>
            </div>

            <p className="leading-relaxed text-slate-700 dark:text-slate-200">
              {aiPlan.summary}
            </p>
            {aiPlan.sourceMessage && <p className="text-[11px] text-slate-600 dark:text-slate-300">{aiPlan.sourceMessage}</p>}

            <div className="rounded-lg border border-slate-300 bg-slate-100 p-3 text-[11px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <strong>Generated market context (not independently verified):</strong> {aiPlan.marketContextEthiopia}
            </div>

            {aiPlan.weeklyPlan && (
              <div className="space-y-3 pt-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Generated 4-week study suggestions (verify resources and details):
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {aiPlan.weeklyPlan.map((step: any) => (
                    <div key={step.week} className="space-y-1 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        Week {step.week}: {step.theme}
                      </div>
                      <div className="text-[11px] text-slate-700 dark:text-slate-300">
                        <strong>Practical Project:</strong> {step.practicalProject}
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400">
                        <strong>Resources:</strong> {step.recommendedResources?.join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <h2 className="font-bold">Learning resources are not connected</h2>
        <p className="mt-1 text-xs leading-5">The backend currently provides a skills catalog and AI-generated guidance, but no verified learning-resource catalog or resource links. No training providers are presented here as if they were live or endorsed resources.</p>
      </section>

    </div>
  );
};
