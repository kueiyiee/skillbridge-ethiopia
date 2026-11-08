import {
  Award,
  Bookmark,
  Briefcase,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';

export type JobSeekerNavigationItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  page?: string;
  tab?: string;
};

export const jobSeekerWorkspaceNavigation: JobSeekerNavigationItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, page: 'seeker-dashboard', tab: 'overview' },
  { id: 'find-jobs', label: 'Find Jobs', icon: Briefcase, page: 'jobs' },
  { id: 'applications', label: 'Applications', icon: FileText, page: 'seeker-dashboard', tab: 'applications' },
  { id: 'messages', label: 'Messages & Opportunities', icon: MessageSquare, page: 'seeker-dashboard', tab: 'messages' },
  { id: 'saved', label: 'Saved Jobs', icon: Bookmark, page: 'seeker-dashboard', tab: 'saved' },
  { id: 'skills', label: 'My Skills', icon: Award, page: 'seeker-dashboard', tab: 'skills' },
  { id: 'roadmap', label: 'Career Roadmap', icon: GitBranch, page: 'seeker-dashboard', tab: 'roadmap' },
  { id: 'explore-skills', label: 'Explore Skills', icon: Search, page: 'career-skills' },
];

export const jobSeekerAccountNavigation: JobSeekerNavigationItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings, page: 'account-profile' },
];
