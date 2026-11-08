import type { ReactNode } from 'react';
import { createContext, useContext, useMemo, useState } from 'react';

type AuthUser = {
  id: string;
  name: string;
  role: 'candidate' | 'employer' | 'admin';
};

type AppContextValue = {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  isAuthenticated: boolean;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProviders({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const value = useMemo(
    () => ({
      user,
      setUser,
      isAuthenticated: Boolean(user),
    }),
    [user],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useAppContext must be used within AppProviders');
  }

  return context;
}
