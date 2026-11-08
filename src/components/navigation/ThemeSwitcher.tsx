import React from 'react';
import { useTheme } from '@/src/app/providers/ThemeContext';
import { Sun, Moon } from 'lucide-react';

export const ThemeSwitcher: React.FC = () => {
  const { toggleMode, isDark } = useTheme();

  const nextThemeLabel = isDark ? 'light' : 'dark';
  const accessibleLabel = isDark
    ? 'Dark theme active; switch to light theme'
    : 'Light theme active; switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggleMode}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
      aria-label={accessibleLabel}
      aria-pressed={isDark}
      title={`Switch to ${nextThemeLabel} mode`}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
};
