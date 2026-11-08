import React, { createContext, useContext, useState, useEffect } from 'react';
import { Role, RegistrationRole, JobSeekerProfile, EmployerProfile, SystemStatus } from '@/shared/types';
import { api } from '@/src/services/api-client';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  emailVerified: boolean;
  avatarUrl?: string | null;
  institutionOrCompany?: string;
}

interface AuthContextType {
  user: User | null;
  role: Role;
  candidateProfile: JobSeekerProfile | null;
  employerProfile: EmployerProfile | null;
  systemStatus: SystemStatus | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<Role>;
  register: (payload: { email: string; password: string; fullName: string; role: RegistrationRole; phone?: string; companyOrSchool?: string }) => Promise<void>;
  completeEmailVerification: (code: string) => Promise<Role>;
  logout: () => Promise<void>;
  refreshCandidate: () => Promise<void>;
  refreshEmployer: () => Promise<void>;
  refreshSystemStatus: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<Role>('JOB_SEEKER');
  const [user, setUser] = useState<User | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<JobSeekerProfile | null>(null);
  const [employerProfile, setEmployerProfile] = useState<EmployerProfile | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resetAuthState = () => {
    setUser(null);
    setCandidateProfile(null);
    setEmployerProfile(null);
    setSystemStatus(null);
    setRole('JOB_SEEKER');
  };

  const initAuth = async () => {
    setIsLoading(true);
    try {
      const me = await api.getMe();
      if (me.user) {
        setUser({ ...me.user, emailVerified: me.user.emailVerified === true });
        setRole(me.user.role);
        if (me.user.role === 'JOB_SEEKER') {
          setCandidateProfile(me.profile ?? null);
          setEmployerProfile(null);
          setSystemStatus(null);
        } else if (me.user.role === 'EMPLOYER') {
          setEmployerProfile(me.profile ?? null);
          setCandidateProfile(null);
          setSystemStatus(null);
        } else if (me.user.role === 'ADMIN') {
          setSystemStatus(await api.getSystemStatus());
          setCandidateProfile(null);
          setEmployerProfile(null);
        }
        return;
      }
      resetAuthState();
    } catch {
      resetAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login({ email, password: pass });
    setUser({ ...res.user, emailVerified: res.user.emailVerified === true });
    setRole(res.user.role);

    if (res.user.role === 'JOB_SEEKER') {
      await refreshCandidate();
    } else if (res.user.role === 'EMPLOYER') {
      await refreshEmployer();
    }
    return res.user.role;
  };

  const register = async (payload: { email: string; password: string; fullName: string; role: RegistrationRole; phone?: string; companyOrSchool?: string }) => {
    await api.register(payload);
  };

  const completeEmailVerification = async (code: string) => {
    const res = await api.verifyEmailCode(code);
    setUser({ ...res.user, emailVerified: res.user.emailVerified === true });
    setRole(res.user.role);

    if (res.user.role === 'JOB_SEEKER') {
      await refreshCandidate();
    } else if (res.user.role === 'EMPLOYER') {
      await refreshEmployer();
    }
    return res.user.role;
  };

  const logout = async () => {
    try {
      await api.logout();
      resetAuthState();
    } catch (error) {
      console.error('[AuthContext] Server logout failed:', error instanceof Error ? error.name : 'UnknownError');
      throw error;
    }
  };

  const refreshCandidate = async () => {
    try {
      const cand = await api.getCandidateProfile();
      setCandidateProfile(cand);
    } catch (e) {
      console.error('Error refreshing candidate:', e);
    }
  };

  const refreshEmployer = async () => {
    try {
      const emp = await api.getEmployerMe();
      setEmployerProfile(emp);
    } catch (e) {
      console.error('Error refreshing employer:', e);
    }
  };

  const refreshSystemStatus = async () => {
    if (role !== 'ADMIN') return;
    try {
      const sys = await api.getSystemStatus();
      setSystemStatus(sys);
    } catch (e) {
      console.error('Error refreshing system status:', e);
    }
  };

  const updateUser = (updates: Partial<User>) => {
    setUser((current) => current ? { ...current, ...updates } : current);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        candidateProfile,
        employerProfile,
        systemStatus,
        isLoading,
        login,
        register,
        completeEmailVerification,
        logout,
        refreshCandidate,
        refreshEmployer,
        refreshSystemStatus,
        updateUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
