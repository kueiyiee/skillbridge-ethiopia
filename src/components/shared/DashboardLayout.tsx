import React from 'react';
import {
  jobSeekerAccountNavigation,
  jobSeekerWorkspaceNavigation,
  type JobSeekerNavigationItem,
} from '@/src/components/navigation/jobSeekerNavigation';
import { BrandLogo } from './BrandLogo';
import { DashboardNotificationCenter } from './DashboardNotificationCenter';

const MIN_SIDEBAR_WIDTH = 208;
const MIN_MAIN_CONTENT_WIDTH = 320;
const DEFAULT_SIDEBAR_WIDTH = 248;
const SIDEBAR_WIDTH_STORAGE_KEY = 'skillbridge_seeker_sidebar_width';

interface DashboardLayoutProps {
  activeTab: string;
  heroBanner?: React.ReactNode;
  onTabChange: (tab: string) => void;
  onNavigate: (page: string) => void;
  children: React.ReactNode;
}

function NavigationButton({
  item,
  active,
  onClick,
  disabled = false,
}: {
  item: JobSeekerNavigationItem;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      title={item.label}
      className={`group relative flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
        active
          ? 'bg-cyan-50 text-cyan-950 dark:bg-cyan-950/50 dark:text-cyan-100'
          : item.id === 'sign-out'
            ? 'text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      {active && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-cyan-600 dark:bg-cyan-300" aria-hidden="true" />}
      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-cyan-800 dark:text-cyan-200' : 'text-slate-400 group-hover:text-cyan-700 dark:group-hover:text-cyan-300'}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600 dark:bg-cyan-300" aria-hidden="true" />}
    </button>
  );
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  activeTab,
  heroBanner,
  onTabChange,
  onNavigate,
  children,
}) => {
  const layoutRef = React.useRef<HTMLDivElement>(null);
  const resizeDragRef = React.useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const [sidebarWidth, setSidebarWidth] = React.useState(() => {
    const storedWidth = Number(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return Number.isFinite(storedWidth) && storedWidth >= MIN_SIDEBAR_WIDTH ? storedWidth : DEFAULT_SIDEBAR_WIDTH;
  });
  const [maxSidebarWidth, setMaxSidebarWidth] = React.useState(DEFAULT_SIDEBAR_WIDTH);
  const [sidebarResizing, setSidebarResizing] = React.useState(false);
  const [sidebarResizeMode, setSidebarResizeMode] = React.useState(false);

  const getMaxSidebarWidth = () => {
    const layout = layoutRef.current;
    if (!layout) return DEFAULT_SIDEBAR_WIDTH;
    const computedStyle = window.getComputedStyle(layout);
    const horizontalPadding = Number.parseFloat(computedStyle.paddingLeft) + Number.parseFloat(computedStyle.paddingRight);
    return Math.max(MIN_SIDEBAR_WIDTH, layout.clientWidth - horizontalPadding - 20 - MIN_MAIN_CONTENT_WIDTH);
  };

  const resizeSidebar = (width: number) => {
    const maximum = getMaxSidebarWidth();
    const nextWidth = Math.min(maximum, Math.max(MIN_SIDEBAR_WIDTH, width));
    setMaxSidebarWidth(maximum);
    setSidebarWidth(nextWidth);
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: sidebarWidth };
    setSidebarResizing(true);
  };

  const handleResizePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = resizeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    resizeSidebar(drag.startWidth + event.clientX - drag.startX);
  };

  const handleResizePointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (resizeDragRef.current?.pointerId !== event.pointerId) return;
    resizeDragRef.current = null;
    setSidebarResizing(false);
  };

  const handleResizePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (resizeDragRef.current?.pointerId !== event.pointerId) return;
    handleResizePointerMove(event);
    handleResizePointerEnd(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleResizeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      setSidebarResizeMode(false);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      if (!sidebarResizeMode) setSidebarResizeMode(true);
      const step = event.shiftKey ? 32 : 16;
      resizeSidebar(sidebarWidth + (event.key === 'ArrowRight' ? step : -step));
    }
  };

  React.useEffect(() => {
    const clampSidebarWidth = () => {
      const maximum = getMaxSidebarWidth();
      setMaxSidebarWidth(maximum);
      setSidebarWidth((currentWidth) => {
        const nextWidth = Math.min(maximum, Math.max(MIN_SIDEBAR_WIDTH, currentWidth));
        if (nextWidth !== currentWidth) localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
        return nextWidth;
      });
    };
    clampSidebarWidth();
    window.addEventListener('resize', clampSidebarWidth);
    return () => window.removeEventListener('resize', clampSidebarWidth);
  }, []);

  const activate = (item: JobSeekerNavigationItem) => {
    if (item.id === 'find-jobs' || item.id === 'explore-skills') {
      onNavigate(item.page || 'jobs');
    } else if (item.tab) {
      onTabChange(item.tab);
    } else if (item.page) {
      onNavigate(item.page);
    }
  };

  return (
    <div className="dashboard-shell dashboard-seeker w-full py-3 sm:py-4">
      <div
        ref={layoutRef}
        style={{
          userSelect: sidebarResizing ? 'none' : undefined,
          '--seeker-sidebar-width': `${sidebarWidth}px`,
        } as React.CSSProperties}
        className="dashboard-seeker-layout mx-auto grid max-w-[1480px] gap-4 px-4 sm:px-6 lg:gap-5 lg:px-8"
      >
        <aside style={{ width: sidebarWidth }} className="sticky top-20 hidden h-[calc(100dvh-6.5rem)] min-h-0 self-start flex-col overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:flex" aria-label="Job seeker dashboard navigation">
          <div className="border-b border-slate-100 px-2 pb-3 pt-1 dark:border-slate-800">
            <BrandLogo size="sm" />
            <p className="mt-3 pl-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Career Workspace</p>
          </div>
          <nav className="flex-none py-2" aria-label="Career workspace navigation">
            <div className="space-y-0.5">
              {jobSeekerWorkspaceNavigation.map((item) => (
                <NavigationButton
                  key={item.id}
                  item={item}
                  active={Boolean(item.tab && item.tab === activeTab)}
                  onClick={() => activate(item)}
                />
              ))}
            </div>
          </nav>

          <div className="mt-2 border-t border-slate-100 pt-1.5 dark:border-slate-800">
            <div className="space-y-0.5">
              {jobSeekerAccountNavigation.map((item) => (
                <NavigationButton key={item.id} item={item} active={false} onClick={() => activate(item)} />
              ))}
            </div>
          </div>
          <button
            type="button"
            onContextMenu={(event) => { event.preventDefault(); setSidebarResizeMode((enabled) => !enabled); }}
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerCancel={handleResizePointerEnd}
            onLostPointerCapture={handleResizePointerEnd}
            onKeyDown={handleResizeKeyDown}
            tabIndex={0}
            aria-label="Resize job seeker sidebar. Drag the edge to resize; use the left and right arrow keys to adjust width."
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={maxSidebarWidth}
            aria-valuenow={sidebarWidth}
            aria-orientation="vertical"
            role="separator"
            className={`absolute inset-y-0 -right-1.5 z-10 hidden w-3 cursor-col-resize touch-none bg-transparent outline-none focus-visible:bg-cyan-400/20 ${sidebarResizing ? 'bg-cyan-400/20' : sidebarResizeMode ? 'bg-cyan-400/10' : ''}`}
          />
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="flex justify-end"><DashboardNotificationCenter role="JOB_SEEKER" onOpen={() => onTabChange('messages')} /></div>
          {heroBanner}
          <nav className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950 lg:hidden" aria-label="Career workspace navigation">
            {jobSeekerWorkspaceNavigation.map((item) => {
              const Icon = item.icon;
              const active = Boolean(item.tab && item.tab === activeTab);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => activate(item)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${active ? 'bg-cyan-50 text-cyan-950 dark:bg-cyan-950/50 dark:text-cyan-100' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          {children}
        </main>
      </div>
    </div>
  );
};
