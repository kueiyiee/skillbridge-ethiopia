import React from 'react';
import { useAiNexus } from '@/src/app/providers/AiNexusContext';
import { useAuth } from '@/src/app/providers/AuthContext';
import { Sparkles } from 'lucide-react';

interface AiNexusLauncherProps {
  currentRoute?: string;
}

export const AiNexusLauncher: React.FC<AiNexusLauncherProps> = ({ currentRoute }) => {
  const { toggleAssistant, isOpen } = useAiNexus();
  const { role } = useAuth();
  const assistantLabel = role === 'JOB_SEEKER' ? 'Career AI' : role === 'EMPLOYER' ? 'Recruiting AI' : 'Platform AI';

  // Floating trigger on bottom right
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 sm:bottom-6 sm:right-6">
      <button
        onClick={toggleAssistant}
        className={`group flex max-w-[calc(100vw-2rem)] items-center gap-2.5 rounded-full border px-4 py-3 shadow-xl transition-all duration-300 transform hover:scale-105 active:scale-95 cursor-pointer ${
          isOpen
            ? 'bg-app-primary text-app-button-primary-foreground border-app-border'
            : 'bg-app-primary text-app-button-primary-foreground border-app-border-strong hover:shadow-md'
        }`}
        aria-label={`${isOpen ? 'Close' : 'Open'} ${assistantLabel} assistant`}
        aria-expanded={isOpen}
        title={`${isOpen ? 'Close' : 'Open'} ${assistantLabel}`}
      >
        <div className="relative">
          <Sparkles className="w-4 h-4 text-app-button-primary-foreground" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold font-heading tracking-tight flex items-center gap-1.5 leading-none">
            {assistantLabel}
          </span>
          <span className="mt-0.5 text-[10px] text-app-button-primary-foreground/80 font-normal leading-none">
            SKILLBRIDGE assistant
          </span>
        </div>
      </button>
    </div>
  );
};
