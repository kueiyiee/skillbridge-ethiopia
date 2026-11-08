export type Role = 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';
export type RegistrationRole = Exclude<Role, 'ADMIN'>;

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type ApplicationStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'SHORTLISTED'
  | 'TECHNICAL_ASSESSMENT'
  | 'INTERVIEW_SCHEDULED'
  | 'OFFERED'
  | 'HIRED'
  | 'REJECTED'
  | 'WITHDRAWN';

export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'REMOTE' | 'HYBRID';

export interface Skill {
  id: string;
  name: string;
  category: string;
  description?: string;
  demandRating: number; // 1-5
  isCoreTech?: boolean;
}

export interface JobSeekerSkill {
  id: string;
  skillId: string;
  skillName: string;
  category: string;
  proficiencyLevel: SkillLevel;
  yearsExperience: number;
  isVerified: boolean;
  verifiedMethod?: string;
  verifiedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  assessmentQuestionCount?: number;
}

export interface JobSeekerProfile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  headline: string;
  bio: string;
  experienceYears: number;
  educationLevel: string;
  institutionName: string;
  city: string;
  subCity?: string;
  desiredRole: string;
  desiredSalaryETB: number;
  availableForWork: boolean;
  skills: JobSeekerSkill[];
}

export interface EmployerProfile {
  id: string;
  userId: string;
  companyName: string;
  industry: string;
  tinNumber?: string;
  businessLicenseNo?: string;
  verificationStatus: VerificationStatus;
  verificationNotes?: string;
  city: string;
  address?: string;
  website?: string;
  employeeRange: string;
  companyOverview: string;
  logoUrl?: string;
  verifiedAt?: string;
  isApproved?: boolean;
}

export interface JobSkillRequirement {
  id: string;
  skillId: string;
  skillName: string;
  category: string;
  isMandatory: boolean;
  weight: number; // 1-5
  requiredLevel: SkillLevel;
}

export interface Job {
  id: string;
  employerId: string;
  employerName: string;
  employerVerified: boolean;
  employerIndustry: string;
  title: string;
  department: string;
  jobType: JobType;
  city: string;
  workplaceType: string; // 'On-site' | 'Remote' | 'Hybrid'
  summary: string;
  responsibilities: string[];
  qualifications: string[];
  minExperienceYears: number;
  salaryMinETB?: number;
  salaryMaxETB?: number;
  isSalaryNegotiable: boolean;
  status: 'ACTIVE' | 'DRAFT' | 'PAUSED' | 'CLOSED';
  effectiveStatus?: Job['status'] | 'EXPIRED';
  deadline: string;
  viewsCount: number;
  createdAt: string;
  skillRequirements: JobSkillRequirement[];
  applicantsCount?: number;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  employerName: string;
  jobSeekerId: string;
  candidateName: string;
  candidateHeadline?: string;
  candidateEmail?: string | null;
  candidatePhone?: string | null;
  candidateCity?: string | null;
  candidateEducation?: string | null;
  candidateExperienceYears?: number | null;
  candidateSkills?: string | null;
  candidateProfileVisibility?: string;
  lastCommunicationAt?: string | null;
  nextInterviewAt?: string | null;
  status: ApplicationStatus;
  matchScore: number; // 0-100
  coverNote?: string;
  appliedAt: string;
}

export interface MatchedSkillDetail {
  skill: string;
  candidateLevel: SkillLevel;
  requiredLevel: SkillLevel;
  levelRatio: number;
  category: string;
}

export interface MissingSkillDetail {
  skill: string;
  requiredLevel: SkillLevel;
  weight: number;
  isMandatory: boolean;
  gapSeverity: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  recommendedResource?: string;
}

export interface SkillGapAnalysisResult {
  jobId: string;
  jobTitle: string;
  overallMatchScore: number; // 0-100
  matchedSkills: MatchedSkillDetail[];
  missingSkills: MissingSkillDetail[];
  strengths: string[];
  actionableInsights: string[];
  roadmapRecommendations: {
    phase: string;
    targetSkill: string;
    estimatedHours: number;
    recommendedActions: string[];
  }[];
}

export interface PerformanceEvaluation {
  id: string;
  employerId: string;
  companyName: string;
  jobSeekerId: string;
  candidateName: string;
  jobId: string;
  jobTitle: string;
  period: string; // e.g. "90-Day Probation Review"
  technicalScore: number; // 1.0 - 5.0
  deliveryScore: number;
  communicationScore: number;
  adaptabilityScore: number;
  overallScore: number;
  strengthsFeedback: string;
  growthAreasFeedback: string;
  retentionRecommendation: 'HIGHLY_RECOMMENDED' | 'CONFIRMED' | 'EXTEND_PROBATION' | 'TERMINATE';
  evaluatedAt: string;
}

export interface SystemStatus {
  status: string;
  database: {
    type: string;
    version?: string;
    orm: string;
    connected: boolean;
    connectionStringConfigured?: boolean;
    persistentStorage?: string;
    activeAdapter: string;
    message: string;
    tableCounts?: Record<string, number>;
    migrationsApplied?: boolean;
    migrations?: {
      status: 'up-to-date' | 'pending' | 'unknown';
      appliedCount: number | null;
      expectedCount: number;
    };
  };
  gemini: {
    configured: boolean;
    model: string;
    availability?: 'not-configured' | 'not-checked' | 'available' | 'unavailable';
    supportsGenerateContent?: boolean | null;
    structuredOutputValidated?: boolean;
  };
  aiProviders?: {
    primaryProvider: 'openai' | 'gemini';
    fallbackProvider: 'openai' | 'gemini';
    configured: boolean;
    providers: Record<'openai' | 'gemini', {
      configured: boolean;
      model: string;
      availability: 'not-configured' | 'not-checked' | 'available' | 'unavailable';
      structuredOutputValidated: boolean;
    }>;
    usage: Record<'openai' | 'gemini', { requests: number; fallbacks: number; failures: number; averageLatencyMs: number }>;
  };
  mlExtension: {
    model: string;
    specVersion: string;
    status: string;
  };
  version: string;
  timestamp: string;
}

export interface AiNexusMessage {
  id: string;
  conversationId: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  isAiGenerated: boolean;
  metadata?: {
    provider?: 'openai' | 'gemini';
    fallbackUsed?: boolean;
    suggestedActions?: string[];
    actionType?: 'JOB_MATCH' | 'SKILL_GAP' | 'INTERVIEW_PREP' | 'CANDIDATE_SEARCH' | 'JD_OPTIMIZE' | 'PLATFORM_METRICS' | 'AUDIT_SUMMARY';
    jobCards?: Array<{ id: string; title: string; employer: string; matchScore?: number; city?: string }>;
    skillBadges?: Array<{ name: string; status: 'matched' | 'missing' | 'in_demand' }>;
    roadmapSteps?: Array<{ step: number; title: string; detail: string }>;
    metricsSummary?: Record<string, string | number>;
    citations?: string[];
  };
  createdAt: string;
}

export interface AiNexusConversation {
  id: string;
  userId: string;
  role: Role;
  title: string;
  contextRoute?: string;
  createdAt: string;
  updatedAt: string;
  messages?: AiNexusMessage[];
}

export interface AiNexusQueryPayload {
  message: string;
  conversationId?: string;
  contextRoute?: string;
  pageContext?: {
    activeTab?: string;
    selectedJobId?: string;
    selectedCandidateId?: string;
  };
}
