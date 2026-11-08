import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Award,
  ArrowRight,
  Bookmark,
  Briefcase,
  Clock,
  Compass,
  HelpCircle,
  Home,
  Info,
  LayoutDashboard,
  Mail,
  Menu,
  Shield,
  Settings,
  Sparkles,
  TrendingUp,
  User,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/src/app/providers/AuthContext';
import { BrandLogo } from '../shared/BrandLogo';
import { ThemeSwitcher } from './ThemeSwitcher';
import { jobSeekerAccountNavigation, jobSeekerWorkspaceNavigation } from './jobSeekerNavigation';

interface HeaderProps {
  currentPage: string;
  onNavigate: (page: string, params?: Record<string, string>) => void;
}

type NavigationItem = {
  page: string;
  label: string;
  icon: LucideIcon;
  params?: Record<string, string>;
};

const publicNavigation: NavigationItem[] = [
  { page: 'landing', label: 'Home', icon: Home },
  { page: 'jobs', label: 'Explore Jobs', icon: Briefcase },
  { page: 'career-skills', label: 'Explore Skills', icon: TrendingUp },
  { page: 'ai-nexus', label: 'Career Guidance', icon: Sparkles },
  { page: 'about', label: 'About SKILLBRIDGE', icon: Info },
  { page: 'contact', label: 'Help & Support', icon: HelpCircle },
];

const dashboardByRole = {
  JOB_SEEKER: { page: 'seeker-dashboard', label: 'My Dashboard' },
  EMPLOYER: { page: 'employer-dashboard', label: 'Employer Dashboard' },
  ADMIN: { page: 'admin-dashboard', label: 'Admin Dashboard' },
} as const;

const publicPages = new Set([
  'landing',
  'jobs',
  'job-detail',
  'career-skills',
  'ai-nexus',
  'about',
  'contact',
]);

export const Header: React.FC<HeaderProps> = ({ currentPage, onNavigate }) => {
  const { user, role, isLoading } = useAuth();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileDashboardMenu, setIsMobileDashboardMenu] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLElement>(null);
  const isPublicPage = publicPages.has(currentPage);
  const isSeekerDashboard = currentPage === 'seeker-dashboard';
  const isEmployerDashboard = currentPage === 'employer-dashboard';
  const isDashboardPage = isSeekerDashboard || isEmployerDashboard;
  const accountDashboard = dashboardByRole[role];
  const workspaceNavigation: NavigationItem[] = role === 'JOB_SEEKER'
    ? jobSeekerWorkspaceNavigation.map(({ page, label, icon: Icon, tab }) => ({
      page: page || 'seeker-dashboard',
      label,
      icon: Icon,
      ...(tab ? { params: { tab } } : {}),
    }))
    : role === 'EMPLOYER' ? [
      { page: 'employer-dashboard', label: 'Overview', icon: LayoutDashboard, params: { section: 'overview' } },
      { page: 'employer-dashboard', label: 'Organization Profile', icon: Shield, params: { section: 'organization' } },
      { page: 'employer-dashboard', label: 'Job Management', icon: Briefcase, params: { section: 'jobs' } },
      { page: 'employer-dashboard', label: 'Applications', icon: User, params: { section: 'applications' } },
      { page: 'employer-dashboard', label: 'Candidate Discovery', icon: User, params: { section: 'discovery' } },
      { page: 'employer-dashboard', label: 'Interviews & Shortlisting', icon: Clock, params: { section: 'interviews' } },
      { page: 'employer-dashboard', label: 'Recruitment Analytics', icon: TrendingUp, params: { section: 'analytics' } },
      { page: 'employer-dashboard', label: 'Reports & Exports', icon: Info, params: { section: 'reports' } },
      { page: 'employer-dashboard', label: 'Messages & Notifications', icon: Mail, params: { section: 'messages' } },
    ] : [];
  const navigationItems = isDashboardPage ? workspaceNavigation : publicNavigation;
  const closeDashboardMenu = () => {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!isDashboardPage) {
      setIsMobileDashboardMenu(false);
      return;
    }
    const query = window.matchMedia('(max-width: 1023px)');
    const updateViewport = () => {
      setIsMobileDashboardMenu(query.matches);
      setIsMenuOpen(false);
    };
    updateViewport();
    query.addEventListener('change', updateViewport);
    return () => query.removeEventListener('change', updateViewport);
  }, [isDashboardPage, isSeekerDashboard]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuContainerRef.current?.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDashboardMenu();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, isMobileDashboardMenu]);

  useEffect(() => {
    if (!isMenuOpen || !isMobileDashboardMenu) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isDashboardPage, isMenuOpen, isMobileDashboardMenu]);

  useEffect(() => {
    if (isMenuOpen && isDashboardPage) {
      requestAnimationFrame(() => {
        const firstVisibleControl = Array.from(menuPanelRef.current?.querySelectorAll<HTMLElement>('button') || [])
          .find((element) => element.getClientRects().length > 0);
        firstVisibleControl?.focus();
      });
    }
  }, [isDashboardPage, isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentPage]);

  const handleNavigate = (page: string, params?: Record<string, string>) => {
    setIsMenuOpen(false);
    onNavigate(page, params);
  };

  const handleDashboardMenuKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab' || !menuPanelRef.current) return;
    const focusable = Array.from(menuPanelRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'))
      .filter((element) => element.getClientRects().length > 0);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const renderDashboardMenu = () => (
    <div className="relative" ref={menuContainerRef}>
      {isMobileDashboardMenu && (
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => {
            if (window.matchMedia('(min-width: 1024px)').matches) return;
            setIsMenuOpen((open) => !open);
          }}
          className="public-nav-trigger lg:hidden"
          aria-label={isMenuOpen ? 'Close workspace menu' : 'Open workspace menu'}
          aria-expanded={isMenuOpen}
          aria-controls="dashboard-navigation-panel"
        >
          {isMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      )}
      {isMenuOpen && isMobileDashboardMenu && (
        <div role="dialog" aria-modal="true" aria-label="Workspace navigation" className="fixed inset-0 z-50 bg-slate-950/50 p-0 lg:hidden">
          <button type="button" className="absolute inset-0 lg:hidden" aria-label="Close workspace menu" onClick={closeDashboardMenu} />
          <nav
            ref={menuPanelRef}
            id="dashboard-navigation-panel"
            onKeyDown={handleDashboardMenuKeyDown}
            className="public-nav-panel dashboard-mobile-nav absolute inset-y-0 left-0 w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-r-2xl border p-3"
            aria-label="Workspace navigation"
          >
            <div className="mb-2 flex items-center justify-between px-3 pb-2 pt-1">
              <p className="public-nav-heading">{isSeekerDashboard ? 'WORKSPACE' : isEmployerDashboard ? 'Employer workspace' : 'Workspace'}</p>
              <button type="button" onClick={closeDashboardMenu} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-600 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" aria-label="Close workspace menu">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-1">
              {navigationItems.map(({ page, label, icon: Icon, params }) => {
                const currentSection = new URLSearchParams(location.search).get('section') || 'overview';
                const currentTab = new URLSearchParams(location.search).get('tab') || 'overview';
                const isActive = page === currentPage
                  && (params?.section ? params.section === currentSection : true)
                  && (params?.tab ? params.tab === currentTab : true);
                return (
                  <button
                    key={`${page}-${label}`}
                    type="button"
                    onClick={() => handleNavigate(page, params)}
                    className="public-nav-item"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                    {isActive && <span className="public-nav-current" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            {!isLoading && user && (
              <>
                <div className="public-nav-divider" />
                <p className="public-nav-heading px-3 pb-2">Account</p>
                <div className="space-y-1">
                  {!isDashboardPage && <button type="button" onClick={() => handleNavigate(accountDashboard.page)} className="public-nav-item">
                    <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{accountDashboard.label}</span>
                  </button>}
                  {(isSeekerDashboard ? jobSeekerAccountNavigation : [
                    { page: 'account-profile', label: 'Settings', icon: Settings },
                  ]).map(({ page, label, icon: Icon }) => (
                    <button key={page} type="button" onClick={() => page && handleNavigate(page)} className="public-nav-item">
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </nav>
        </div>
      )}
    </div>
  );

  const renderPublicMenu = (align: 'left' | 'right') => (
    <div className="relative" ref={menuContainerRef}>
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setIsMenuOpen((open) => !open)}
        className="public-nav-trigger"
        aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={isMenuOpen}
        aria-controls="public-navigation-panel"
        aria-haspopup="true"
      >
        {isMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>
      {isMenuOpen && (
        <nav id="public-navigation-panel" className={`public-nav-panel absolute top-[calc(100%+0.75rem)] max-h-[calc(100dvh-6rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-3 ${align === 'left' ? 'left-0' : 'right-0'}`} aria-label="Main navigation">
          <p className="public-nav-heading px-3 pb-2 pt-1">Explore SKILLBRIDGE</p>
          <div className="space-y-1">
            {publicNavigation.map(({ page, label, icon: Icon }) => {
              const isActive = isPublicPage && currentPage === page;
              return <button key={`${page}-${label}`} type="button" onClick={() => handleNavigate(page)} className="public-nav-item" aria-current={isActive ? 'page' : undefined}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{label}</span>{isActive && <span className="public-nav-current" aria-hidden="true" />}</button>;
            })}
          </div>
          {!isLoading && user ? (
            <>
              <div className="public-nav-divider" />
              <p className="public-nav-heading px-3 pb-2">Your account</p>
              <div className="space-y-1">
                <button type="button" onClick={() => handleNavigate(accountDashboard.page)} className="public-nav-item"><LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{accountDashboard.label}</span></button>
                <button type="button" onClick={() => handleNavigate('account-profile')} className="public-nav-item"><Settings className="h-4 w-4 shrink-0" aria-hidden="true" /><span>Settings</span></button>
              </div>
            </>
          ) : !isLoading ? (
            <>
              <div className="public-nav-divider" />
              <p className="public-nav-heading px-3 pb-2">Get started</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => handleNavigate('auth', { mode: 'login' })} className="public-nav-secondary"><User className="h-4 w-4" aria-hidden="true" />Sign In</button>
                <button type="button" onClick={() => handleNavigate('auth', { mode: 'signup' })} className="public-nav-primary">Create Account<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </>
          ) : null}
          <p className="public-nav-tagline">Bridging Talent to Opportunity Through Verified Skills.</p>
        </nav>
      )}
    </div>
  );

  return (
    <header className="public-header sticky top-0 z-40 border-b">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2">
          {isDashboardPage ? renderDashboardMenu() : null}
          <button
            type="button"
            onClick={() => handleNavigate('landing')}
            className={`flex min-w-0 items-center text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-app-focus ${isDashboardPage ? 'lg:hidden' : ''}`}
            aria-label="SKILLBRIDGE ET home"
          >
            <BrandLogo size="md" showSubtitle={false} />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isDashboardPage && renderPublicMenu('right')}
          <ThemeSwitcher />
        </div>
      </div>
    </header>
  );
};
