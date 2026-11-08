import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Role } from '@/shared/types';
import { useAuth } from './AuthContext';

export type ThemeMode = 'light' | 'dark';
export type ThemeScope = 'job-seeker' | 'employer' | 'admin' | 'public';

interface ThemeContextType {
  mode: ThemeMode;
  scope: ThemeScope;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  isDark: boolean;
}

type ThemePreferences = Record<ThemeScope, ThemeMode>;

const LEGACY_STORAGE_KEYS = ['skillbridge_theme', 'skillbridge_atmos_theme', 'skillbridge_atmos_mode'];
const STORAGE_KEYS: Record<ThemeScope, string> = {
  'job-seeker': 'skillbridge-theme-job-seeker',
  employer: 'skillbridge-theme-employer',
  admin: 'skillbridge-theme-admin',
  public: 'skillbridge-theme-public',
};
const SCOPES = Object.keys(STORAGE_KEYS) as ThemeScope[];

function preferredTheme(): ThemeMode {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function savedTheme(key: string): ThemeMode | null {
  try {
    const saved = localStorage.getItem(key);
    return saved === 'light' || saved === 'dark' ? saved : null;
  } catch {
    return null;
  }
}

function initialPreferences(): ThemePreferences {
  const legacyTheme = LEGACY_STORAGE_KEYS.map(savedTheme).find((value) => value !== null) ?? preferredTheme();
  return Object.fromEntries(
    SCOPES.map((scope) => [scope, savedTheme(STORAGE_KEYS[scope]) ?? legacyTheme]),
  ) as ThemePreferences;
}

function scopeForRoute(pathname: string, role: Role | undefined): ThemeScope {
  if (pathname === '/dashboard/seeker') return 'job-seeker';
  if (pathname === '/dashboard/employer') return 'employer';
  if (pathname === '/admin') return 'admin';
  if (pathname.startsWith('/account/')) {
    if (role === 'JOB_SEEKER') return 'job-seeker';
    if (role === 'EMPLOYER') return 'employer';
    if (role === 'ADMIN') return 'admin';
  }
  return 'public';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const scope = scopeForRoute(location.pathname, user?.role);
  const [preferences, setPreferences] = useState<ThemePreferences>(initialPreferences);
  const activeScope = useRef(scope);
  const persistenceTimers = useRef<Partial<Record<ThemeScope, number>>>({});
  activeScope.current = scope;
  const mode = preferences[scope];

  const applyTheme = useCallback((targetScope: ThemeScope, nextMode: ThemeMode) => {
    const scopedRoot = document.querySelector<HTMLElement>(`[data-theme-scope="${targetScope}"]`);
    scopedRoot?.setAttribute('data-theme', nextMode);
    if (scopedRoot) scopedRoot.style.colorScheme = nextMode;

    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColor?.setAttribute('content', nextMode === 'dark' ? '#0a0a0a' : '#ffffff');
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    if (nextMode !== 'light' && nextMode !== 'dark') return;
    const targetScope = activeScope.current;
    applyTheme(targetScope, nextMode);
    setPreferences((current) => ({ ...current, [targetScope]: nextMode }));

    const existingTimer = persistenceTimers.current[targetScope];
    if (existingTimer !== undefined) window.clearTimeout(existingTimer);
    persistenceTimers.current[targetScope] = window.setTimeout(() => {
      delete persistenceTimers.current[targetScope];
      try {
        localStorage.setItem(STORAGE_KEYS[targetScope], nextMode);
      } catch {
        // Keep the in-memory theme even when browser storage is unavailable.
      }
    }, 0);
  }, [applyTheme]);

  const toggleMode = useCallback(() => {
    const targetScope = activeScope.current;
    const scopedRoot = document.querySelector<HTMLElement>(`[data-theme-scope="${targetScope}"]`);
    const currentMode = scopedRoot?.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    setMode(currentMode === 'dark' ? 'light' : 'dark');
  }, [setMode]);

  useEffect(() => {
    const syncThemeFromAnotherTab = (event: StorageEvent) => {
      const targetScope = SCOPES.find((candidate) => STORAGE_KEYS[candidate] === event.key);
      if (!targetScope || (event.newValue !== 'light' && event.newValue !== 'dark')) return;
      setPreferences((current) => ({ ...current, [targetScope]: event.newValue as ThemeMode }));
      if (targetScope === activeScope.current) applyTheme(targetScope, event.newValue);
    };
    window.addEventListener('storage', syncThemeFromAnotherTab);
    return () => {
      window.removeEventListener('storage', syncThemeFromAnotherTab);
      Object.values(persistenceTimers.current).forEach((timer) => {
        if (timer !== undefined) window.clearTimeout(timer);
      });
      persistenceTimers.current = {};
    };
  }, [applyTheme]);

  const contextValue = useMemo(
    () => ({ mode, scope, setMode, toggleMode, isDark: mode === 'dark' }),
    [mode, scope, setMode, toggleMode],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const ThemeScopeRoot: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => {
  const { mode, scope } = useTheme();

  useLayoutEffect(() => {
    const documentRoot = document.documentElement;
    documentRoot.classList.remove('dark');
    documentRoot.removeAttribute('data-theme');
    documentRoot.removeAttribute('data-theme-scope');
    documentRoot.style.removeProperty('color-scheme');
  }, []);

  return (
    <div
      data-theme-scope={scope}
      data-theme={mode}
      className={className}
      style={{ colorScheme: mode }}
    >
      {children}
    </div>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
