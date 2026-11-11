import React from 'react';
import { BrandLogo } from './BrandLogo';
import { EthiopianDateTime } from './EthiopianDateTime';

interface FooterProps {
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600 transition-colors dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      <div className="mx-auto max-w-7xl px-4 pt-9 pb-24 sm:px-6 sm:py-9 lg:px-8">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4 sm:gap-8">
          <div className="col-span-2 space-y-3 sm:col-span-1">
            <BrandLogo size="md" />
            <p className="max-w-xs text-sm leading-6 text-slate-600 dark:text-slate-400">
              Skills-first job discovery and career guidance for Ethiopia.
            </p>
          </div>

          <nav aria-label="Platform" className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Platform</h2>
            <ul className="space-y-2.5 text-sm">
              <li><button onClick={() => onNavigate('jobs')} className="text-left transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">Find Jobs</button></li>
              <li><button onClick={() => onNavigate('career-skills')} className="text-left transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">Explore Skills</button></li>
              <li><a href="/#how-it-works" className="transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">How It Works</a></li>
              <li><button onClick={() => onNavigate('about')} className="text-left transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">About SKILLBRIDGE</button></li>
            </ul>
          </nav>

          <nav aria-label="For employers" className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">For Employers</h2>
            <ul className="space-y-2.5 text-sm">
              <li><button onClick={() => onNavigate('auth', { mode: 'signup' })} className="text-left transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">Hire Talent</button></li>
              <li><button onClick={() => onNavigate('employer-dashboard')} className="text-left transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">Post a Job</button></li>
              <li><button onClick={() => onNavigate('employer-dashboard')} className="text-left transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">Employer Verification</button></li>
            </ul>
          </nav>

          <nav aria-label="Support and legal" className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Support &amp; Legal</h2>
            <ul className="space-y-2.5 text-sm">
              <li><button onClick={() => onNavigate('contact')} className="text-left transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">Contact / Help</button></li>
              <li><a href="/about#privacy-and-data" className="transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">Privacy Policy</a></li>
              <li><a href="/about#platform-terms" className="transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">Terms of Service</a></li>
              <li><a href="/about#academic-credits" className="transition hover:text-sky-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:hover:text-sky-300">Academic Credits</a></li>
            </ul>
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-slate-200 pt-5 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SKILLBRIDGE ET · Computer Science academic capstone.</span>
          <span className="inline-flex items-center gap-2" aria-live="off">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Local time</span>
            <EthiopianDateTime />
          </span>
        </div>
      </div>
    </footer>
  );
};
