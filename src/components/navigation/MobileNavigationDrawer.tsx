import React, { useEffect, useRef } from 'react';
import { BrandLogo } from '../shared/BrandLogo';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useAuth } from '@/src/app/providers/AuthContext';
import { Role } from '@/shared/types';
import { 
  X, 
  Home, 
  Briefcase, 
  TrendingUp, 
  Sparkles,
  Info, 
  HelpCircle, 
  User, 
  Building2, 
  ShieldCheck, 
  LogOut, 
  Settings,
  LayoutDashboard,
  Bookmark,
  CheckCircle2,
  FileText,
  Activity,
  Layers,
  Users
} from 'lucide-react';

interface MobileNavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  onNavigate: (page: string, params?: any) => void;
}

type NavItem = {
  page: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  params?: { tab: string } | { section: string };
};

export const MobileNavigationDrawer: React.FC<MobileNavigationDrawerProps> = ({
  isOpen,
  onClose,
  currentPage,
  onNavigate
}) => {
  const { user, role, logout } = useAuth();
  const drawerRef = useRef<HTMLDivElement>(null);

  // Lock background body scroll while drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleLinkClick = (page: string, params?: any) => {
    onNavigate(page, params);
    onClose();
  };

  const getDashboardTarget = () => {
    if (role === 'EMPLOYER') return 'employer-dashboard';
    if (role === 'ADMIN') return 'admin-dashboard';
    return 'seeker-dashboard';
  };

  const publicNavItems: NavItem[] = [
    { page: 'landing', label: 'Home', icon: Home },
    { page: 'jobs', label: 'Browse Jobs', icon: Briefcase },
    { page: 'career-skills', label: 'Skills', icon: TrendingUp },
    { page: 'ai-nexus', label: 'Career AI', icon: Sparkles },
    { page: 'about', label: 'About', icon: Info },
    { page: 'contact', label: 'Help', icon: HelpCircle }
  ];

  const roleNavItemsMap: Record<Role, NavItem[]> = {
    JOB_SEEKER: [
      { page: 'seeker-dashboard', label: 'Dashboard', icon: LayoutDashboard, params: { tab: 'recommendations' } },
      { page: 'jobs', label: 'Find Jobs', icon: Briefcase },
      { page: 'seeker-dashboard', label: 'My Applications', icon: Briefcase, params: { tab: 'applications' } },
      { page: 'seeker-dashboard', label: 'Saved Jobs', icon: Bookmark, params: { tab: 'saved' } },
      { page: 'seeker-dashboard', label: 'My Skills', icon: TrendingUp, params: { tab: 'skills' } },
      { page: 'career-skills', label: 'Skill Gap Analysis', icon: TrendingUp },
      { page: 'ai-nexus', label: 'Career AI', icon: Sparkles }
    ],
    EMPLOYER: [
      { page: 'employer-dashboard', label: 'Dashboard', icon: LayoutDashboard, params: { tab: 'jobs' } },
      { page: 'employer-dashboard', label: 'Manage Jobs', icon: Briefcase, params: { tab: 'jobs' } },
      { page: 'employer-dashboard', label: 'Applicants', icon: Users, params: { tab: 'applicants' } },
      { page: 'employer-dashboard', label: 'Recruitment Analytics', icon: Activity, params: { tab: 'analytics' } },
      { page: 'employer-dashboard', label: 'Verification Status', icon: Building2, params: { tab: 'analytics' } },
      { page: 'ai-nexus', label: 'Career AI', icon: Sparkles }
    ],
    ADMIN: [
      { page: 'admin-dashboard', label: 'Admin Dashboard', icon: ShieldCheck, params: { section: 'overview' } },
      { page: 'admin-dashboard', label: 'User Management', icon: User, params: { section: 'users' } },
      { page: 'admin-dashboard', label: 'Employer Verification', icon: CheckCircle2, params: { section: 'verifications' } },
      { page: 'admin-dashboard', label: 'Reports & Analytics', icon: Activity, params: { section: 'reports' } },
      { page: 'admin-dashboard', label: 'Platform Activity', icon: Layers, params: { section: 'diagnostics' } },
      { page: 'ai-nexus', label: 'Career AI', icon: Sparkles }
    ]
  };

  const currentNavItems: NavItem[] = user && role ? roleNavItemsMap[role] : publicNavItems;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300"
      aria-modal="true"
      role="dialog"
      aria-label="Mobile Navigation Menu"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={drawerRef}
        className="w-[min(100vw,22rem)] max-w-full bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 transition-all duration-300 ease-out animate-in slide-in-from-right"
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
          <button 
            onClick={() => handleLinkClick('landing')}
            className="focus:outline-none"
            aria-label="SkillBridge Home"
          >
            <BrandLogo size="sm" showSubtitle={false} />
          </button>
          
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Account shortcuts; personal details are managed in Settings. */}
          {user && currentPage !== 'seeker-dashboard' ? (
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-800/80">
              <button
                onClick={() => handleLinkClick('account-settings')}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-sky-300"
              >
                <Settings className="h-4 w-4" />
                <span>Settings</span>
              </button>
              <button
                onClick={() => handleLinkClick(getDashboardTarget())}
                className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-sky-800 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>My Dashboard</span>
              </button>
            </div>
          ) : !user ? (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Welcome to SKILLBRIDGE
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Sign in to match skills with verified Ethiopian employers.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => handleLinkClick('auth', { mode: 'login' })}
                  className="min-h-[44px] flex items-center justify-center text-xs font-semibold px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Sign in
                </button>
                <button
                  onClick={() => handleLinkClick('auth', { mode: 'signup' })}
                  className="min-h-[44px] flex items-center justify-center text-xs font-semibold px-3 py-2 rounded-lg bg-slate-900 dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 text-white"
                >
                  Get started
                </button>
              </div>
            </div>
          ) : null}

          {/* Primary Navigation Links */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mb-2">
              {user ? 'Role Navigation' : 'Navigation'}
            </div>
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const routeParam = item.params && ('section' in item.params ? item.params.section : item.params.tab);
              const routeParamKey = item.params && ('section' in item.params ? 'section' : 'tab');
              const matchesParam = !routeParam || new URLSearchParams(window.location.search).get(routeParamKey!) === routeParam;
              const isActive = currentPage === item.page && matchesParam;

              return (
                <button
                  key={`${item.page}-${item.label}`}
                  onClick={() => handleLinkClick(item.page, item.params)}
                  className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                    isActive
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Dark theme</span>
            <ThemeSwitcher />
          </div>

        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          {user && currentPage !== 'seeker-dashboard' ? (
            <button
              onClick={() => {
                logout();
                handleLinkClick('auth');
              }}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out Account</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
