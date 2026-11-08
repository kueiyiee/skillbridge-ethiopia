import React from 'react';
import { ArrowRight, Building2, CheckCircle2, Code2, Database, GraduationCap, Server, Sparkles } from 'lucide-react';
import { BackButton } from '@/src/components/navigation/BackButton';

interface AboutPageProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="pb-16">
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 lg:px-8">
        <BackButton fallbackTo="/" fallbackLabel="Back to Home" />
      </div>
      <header className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300">Computer Science · Final-year academic capstone</p>
          <h1 className="mt-3 font-heading text-3xl font-extrabold leading-tight text-slate-950 dark:text-white sm:text-4xl">About SKILLBRIDGE</h1>
          <p className="mt-4 max-w-4xl text-lg leading-8 text-slate-700 dark:text-slate-200">
            An AI-Powered Platform for Skill-Based Job Matching, Skill-Gap Analysis, and Employer Performance Evaluation in Ethiopia.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            This capstone explores how a recruitment platform can make job requirements, candidate skill profiles, and learning guidance more explicit. It is a working product prototype as well as an academic investigation; match scores and recommendations support decisions, they do not make them.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => onNavigate('jobs')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600">
              Explore jobs <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button onClick={() => onNavigate('auth', { mode: 'signup' })} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800">
              Create an account
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="research-problem">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300">01 · Motivation</p>
            <h2 id="research-problem" className="mt-2 font-heading text-2xl font-bold text-slate-950 dark:text-white">Research problem and national context</h2>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-700 dark:text-slate-300">
              <p>Recruitment processes can depend heavily on static CVs and keyword matching. These signals may make it difficult to distinguish a listed skill from a candidate’s stated proficiency, compare competencies with role requirements, or explain where a profile does not yet align.</p>
              <p>SKILLBRIDGE investigates a more explicit workflow: represent candidate skills and proficiency levels, compare them with weighted job requirements, and offer guidance that candidates can use to plan further learning. The Ethiopian context informs the project’s intended users and product design; this capstone does not assert unsupported national employment statistics, labor-market measurements, or institutional findings.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="contributions">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300">02 · Contributions</p>
            <h2 id="contributions" className="mt-2 font-heading text-2xl font-bold text-slate-950 dark:text-white">Three connected capabilities</h2>
          </div>
          <div className="mt-7 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-700 dark:border-slate-700">
            <article className="grid gap-3 py-6 sm:grid-cols-[3rem_1fr] sm:gap-5">
              <div className="text-sm font-bold text-sky-800 dark:text-sky-300">01</div>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Weighted skill matching</h3>
                  <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">Implemented</span>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">The matcher compares a candidate’s recorded proficiency with each job’s required level. Job requirements carry weights; mandatory requirements receive additional weight. The overall estimate also considers stated years of experience. A match percentage is a calculated measure of alignment with those inputs, not a probability of hiring or a guarantee of suitability.</p>
              </div>
            </article>
            <article className="grid gap-3 py-6 sm:grid-cols-[3rem_1fr] sm:gap-5">
              <div className="text-sm font-bold text-sky-800 dark:text-sky-300">02</div>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-white">AI-assisted skill-gap roadmaps</h3>
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Partially implemented</span>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">The matching workflow identifies missing or under-level skills and can provide practical project and learning suggestions. A server-side Gemini assistant can provide additional guidance when configured; deterministic responses remain available when the provider is unavailable. AI-generated suggestions are not verified facts and should be checked against authoritative learning resources.</p>
              </div>
            </article>
            <article className="grid gap-3 py-6 sm:grid-cols-[3rem_1fr] sm:gap-5">
              <div className="text-sm font-bold text-sky-800 dark:text-sky-300">03</div>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Employer performance feedback</h3>
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Partially implemented</span>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">An authenticated employer can submit scores and feedback for an existing candidate and a job they own. The API checks employer role, candidate existence, and job ownership, but does not verify that the candidate was hired. Linking evaluations to confirmed post-hire outcomes and studying how those outcomes relate to recruitment decisions remain future research; no such relationship has been established or used to calibrate matching.</p>
              </div>
            </article>
          </div>
        </section>

        <section aria-labelledby="methodology">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300">03 · Method</p>
            <h2 id="methodology" className="mt-2 font-heading text-2xl font-bold text-slate-950 dark:text-white">Research methodology</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">The prototype models a four-stage workflow. It describes implemented software behavior, not measured experimental outcomes.</p>
          </div>
          <ol className="mt-7 grid gap-x-8 gap-y-7 sm:grid-cols-2">
            <li className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300 text-sm font-bold text-sky-800 dark:border-sky-700 dark:text-sky-300">1</span>
              <div><h3 className="font-semibold text-slate-950 dark:text-white">Candidate skill-profile modeling</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">Candidate profiles record skills, self-reported proficiency levels, and experience. Skill records may also carry a verification indicator.</p></div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300 text-sm font-bold text-sky-800 dark:border-sky-700 dark:text-sky-300">2</span>
              <div><h3 className="font-semibold text-slate-950 dark:text-white">Weighted candidate-job matching</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">The deterministic TypeScript matcher compares proficiency ranks against job requirements and combines the skill score with an experience score. Default weights are 70% skills and 30% experience; configured weights are normalized.</p></div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300 text-sm font-bold text-sky-800 dark:border-sky-700 dark:text-sky-300">3</span>
              <div><h3 className="font-semibold text-slate-950 dark:text-white">AI-assisted skill-gap analysis</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">The matcher identifies missing and under-level competencies. Project and exercise suggestions are produced from deterministic templates; the separately configured AI assistant can add contextual guidance.</p></div>
            </li>
            <li className="flex gap-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sky-300 text-sm font-bold text-sky-800 dark:border-sky-700 dark:text-sky-300">4</span>
              <div><h3 className="font-semibold text-slate-950 dark:text-white">Post-hire performance evaluation</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">The platform supports employer-submitted evaluation records, but does not currently verify a hire relationship. Linking and analyzing confirmed post-hire outcomes is a research opportunity, not a validated result reported by this project.</p></div>
            </li>
          </ol>
          <details className="mt-7 max-w-4xl rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700">
            <summary className="cursor-pointer text-sm font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:text-white">Matching calculation used by the current engine</summary>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-300">
              <p>Each proficiency level maps to a rank: Beginner 1, Intermediate 2, Advanced 3, Expert 4. For each requirement, the earned fraction is the candidate rank divided by the required rank, capped at 1. A mandatory requirement’s configured weight is multiplied by 1.5.</p>
              <p className="font-mono text-xs sm:text-sm">Skill score = 100 × sum(weight × earned fraction) / sum(weight)</p>
              <p>The final estimate is the weighted sum of the skill score and experience score. Experience shortfall is scaled by candidate years / required years; meeting or exceeding the requirement scores 100. The default blend is 0.70 skill and 0.30 experience. This rule-based score is not a statistical prediction.</p>
            </div>
          </details>
        </section>

        <section aria-labelledby="architecture">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300">04 · Implementation</p>
            <h2 id="architecture" className="mt-2 font-heading text-2xl font-bold text-slate-950 dark:text-white">System architecture</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">The browser application calls same-origin REST APIs. The Express backend validates requests, applies role and ownership checks, and accesses the MySQL data layer through Drizzle ORM.</p>
          </div>
          <div className="mt-7 grid gap-x-8 gap-y-6 border-y border-slate-200 py-6 sm:grid-cols-2 dark:border-slate-700">
            <div className="flex gap-3"><Code2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Frontend</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">React 19, TypeScript, Vite, and Tailwind CSS.</p></div></div>
            <div className="flex gap-3"><Server className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Backend</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">Node.js, Express.js, and REST APIs with request validation and role-based authorization.</p></div></div>
            <div className="flex gap-3"><Database className="mt-0.5 h-5 w-5 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Data layer</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">MySQL with Drizzle ORM.</p></div></div>
            <div className="flex gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden="true" /><div><h3 className="font-semibold text-slate-950 dark:text-white">AI integration</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">OpenAI and Gemini requests run on the server using the configured provider order. API keys remain server-side and are never included in the frontend.</p></div></div>
            <div className="flex gap-3"><Building2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden="true" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Employer verification</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">Employers submit TIN and business-registration details for internal administrator review. No automated government registry integration is represented.</p></div></div>
            <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden="true" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Future machine-learning extension</h3><p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-300">Python and scikit-learn are documented as a future extension. The current application API does not call that service; job matching currently runs in TypeScript.</p></div></div>
          </div>
        </section>

        <section id="academic-credits" aria-labelledby="academic-information" className="scroll-mt-24 border-t border-slate-200 pt-8 dark:border-slate-700">
          <div className="flex gap-4">
            <GraduationCap className="mt-1 h-6 w-6 shrink-0 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300">05 · Academic context</p>
              <h2 id="academic-information" className="mt-2 font-heading text-2xl font-bold text-slate-950 dark:text-white">Academic information</h2>
              <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">SKILLBRIDGE is a Computer Science final-year academic capstone. Project contact information supplied with the platform identifies Dilla University and the School of Computing &amp; Informatics, Main Campus, Dilla, Ethiopia. No individual supervisor details were supplied for publication. This project description does not imply official University endorsement or approval.</p>
              <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">© 2026 SKILLBRIDGE ET. Final-year academic capstone project.</p>
            </div>
          </div>
        </section>

        <section id="privacy-and-data" aria-labelledby="privacy-heading" className="scroll-mt-24 border-t border-slate-200 pt-8 dark:border-slate-700">
          <h2 id="privacy-heading" className="font-heading text-xl font-bold text-slate-950 dark:text-white">Privacy and data governance</h2>
          <div className="mt-4 max-w-4xl space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <p>Account and profile details submitted to SKILLBRIDGE are stored in the application’s configured MySQL database. Passwords are hashed on the server before storage. Authentication uses a short-lived HTTP-only session cookie invalidated on sign-out.</p>
            <p>When AI guidance is configured and used, submitted prompts and relevant role or profile context may be processed by the server-configured AI provider. Avoid including sensitive personal information in AI prompts. Employer approval is an internal SKILLBRIDGE review, not government certification or endorsement.</p>
          </div>
        </section>

        <section id="platform-terms" aria-labelledby="terms-heading" className="scroll-mt-24 border-t border-slate-200 pt-8 dark:border-slate-700">
          <h2 id="terms-heading" className="font-heading text-xl font-bold text-slate-950 dark:text-white">Platform terms</h2>
          <div className="mt-4 max-w-4xl space-y-3 text-sm leading-6 text-slate-700 dark:text-slate-300">
            <p>Provide accurate information when creating an account, listing a vacancy, or presenting skills and experience. Use the platform for legitimate career and recruitment activity.</p>
            <p>Job listings are subject to internal review. Skill matches and AI-generated guidance support discovery and planning; they do not guarantee an interview, offer, or employment outcome. Verify important advice and opportunity details independently.</p>
          </div>
        </section>
      </div>
    </div>
  );
};
