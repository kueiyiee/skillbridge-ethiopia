import { 
  Job, 
  JobSeekerProfile, 
  EmployerProfile, 
  Application, 
  PerformanceEvaluation, 
  SkillGapAnalysisResult, 
  Skill, 
  SkillLevel,
  JobSeekerSkill,
  SystemStatus,
  RegistrationRole,
  Role
} from '@/shared/types';

export type ApplicationMessageKind =
  | 'MESSAGE'
  | 'APPLICATION_UPDATE'
  | 'SHORTLISTED'
  | 'INTERVIEW_INVITATION'
  | 'INFORMATION_REQUEST'
  | 'ASSESSMENT_REQUEST';

export interface ApplicationMessage {
  id: string;
  applicationId: string;
  senderUserId: string;
  recipientUserId: string;
  senderName: string;
  kind: ApplicationMessageKind;
  subject: string | null;
  body: string;
  dueAt: string | null;
  actionStatus: 'NONE' | 'PENDING' | 'ACCEPTED' | 'DECLINED';
  readAt: string | null;
  createdAt: string;
}

export interface ApplicationMessageThread {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  applicationStatus: Application['status'];
  candidateUserId: string;
  candidateName: string;
  employerUserId: string;
  employerName: string;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageKind: ApplicationMessageKind | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
}

export interface CandidateSkillAssessmentQuestion {
  id: string;
  prompt: string;
  options: string[];
}

export interface CandidateSkillAssessment {
  id: string;
  skillId: string;
  skillName: string;
  scorePercentage: number;
  levelAchieved: SkillLevel;
  questionsCount: number;
  completedAt: string;
}

export interface CandidateSkillAssessmentResult extends CandidateSkillAssessment {
  correctCount: number;
  verified: boolean;
}

const adminRequestTimeout = () => AbortSignal.timeout(10_000);

if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('skillbridge_token');
  } catch {
  }
}

const getHeaders = (hasBody = true): HeadersInit => {
  const headers: Record<string, string> = {};
  if (hasBody) headers['Content-Type'] = 'application/json';
  return headers;
};

const safeJson = async (res: Response, fallbackDesc = 'Request failed'): Promise<any> => {
  const contentType = res.headers.get('content-type') || '';
  let data: any;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    const text = await res.text();
    if (text.includes('<!doctype') || text.includes('<html')) {
      throw new Error(`Server returned HTML (${res.status} ${res.statusText || 'Error'}): ${fallbackDesc}`);
    }
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) throw new Error(`${fallbackDesc} (${res.status})`);
      throw new Error(text || `${fallbackDesc} (${res.status})`);
    }
  }

  if (!res.ok || data?.success === false) {
    const error = new Error(data?.error || `${fallbackDesc} (${res.status})`) as Error & { verificationPending?: boolean };
    if (data?.verificationPending === true) error.verificationPending = true;
    throw error;
  }
  return data;
};

function requireArray<T>(value: unknown, description: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${description} returned an invalid response.`);
  return value;
}

export interface PublicReportVerification {
  reportId: string;
  reportTitle: string;
  reportType: string;
  issuerRole: 'ADMIN' | 'EMPLOYER';
  generatedAt: string;
  recordCount: number;
  reportHash: string;
  status: 'VALID' | 'REVOKED';
}

export interface AdminPageResult<T> {
  count: number;
  data: T[];
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminUserSummary {
  totalAccounts: number;
  verifiedEmails: number;
  accountsNeedingVerification: number;
  emailVerificationActionRequired: number;
  suspendedAccounts: number;
}

export type AdminManagementEntity = 'users' | 'employers' | 'jobs' | 'verifications' | 'applications';
export interface AdminManagementOptions {
  employers: Array<{ id: string; label: string }>;
  jobs: Array<{ id: string; label: string }>;
  candidates: Array<{ id: string; label: string }>;
}

export interface AdminEmployerVerificationSummary {
  totalEmployers: number;
  awaitingBusinessVerification: number;
  awaitingEmailVerification: number;
  awaitingEmployerEmailVerification: number;
  verifiedEmployers: number;
  rejectedApplications: number;
  needsMoreInformation: number;
  documentsAwaitingReview: number;
}

export interface EmployerVerificationDocument {
  id: string;
  employerId: string;
  verificationRecordId: string;
  category: 'BUSINESS_REGISTRATION' | 'TIN_CERTIFICATE' | 'SUPPORTING';
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED';
  reviewNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerName?: string | null;
}

export interface EmployerVerificationHistoryItem {
  id: string;
  tinNumber: string | null;
  businessLicenseNo: string | null;
  status: string;
  reviewNotes: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
}

export type AdminReportType =
  | 'platform-overview'
  | 'employer-verification'
  | 'user-management'
  | 'jobs-moderation'
  | 'applications'
  | 'audit-activity'
  | 'system-health'
  | 'ai-integration-usage';

export type AdminReportFormat = 'pdf' | 'xlsx' | 'csv';

export type EmployerReportType = 'job-performance' | 'applications' | 'pipeline' | 'candidate-activity';

export interface EmployerReport {
  type: EmployerReportType;
  generatedAt: string;
  period: { startDate: string | null; endDate: string | null };
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  summary: Array<{ label: string; value: number | string }>;
  columns: Array<{ key: string; label: string; type: 'text' | 'date' | 'number' }>;
  rows: Array<Record<string, unknown>>;
}

export interface AdminReport {
  type: AdminReportType;
  title: string;
  generatedAt: string;
  period: { startDate: string | null; endDate: string | null; endDateInclusive: boolean; timeZone: string };
  filters: Record<string, string | undefined>;
  summary: Array<{ label: string; value: number | string }>;
  columns: Array<{ key: string; label: string; type: 'text' | 'date' | 'number' | 'boolean' }>;
  rows: Array<Record<string, unknown>>;
  totalRecords: number;
  includedRecords: number;
  truncated: boolean;
  notes: string[];
}

export interface CandidateDiscoveryFilters {
  q?: string;
  skill?: string;
  location?: string;
  minExperience?: number;
  availability?: 'available' | 'unavailable';
  sort?: 'relevance' | 'recent' | 'experience';
  page?: number;
  pageSize?: number;
}

export interface CandidateDiscoverySkill {
  name: string;
  proficiencyLevel: string;
  yearsExperience: number;
  isVerified: boolean;
  category?: string;
}

export interface CandidateDiscoveryCandidate {
  profileId: string;
  fullName: string;
  headline: string | null;
  desiredRole: string | null;
  experienceYears: number;
  city: string | null;
  availableForWork: boolean;
  skills: CandidateDiscoverySkill[];
  applicationId: string | null;
  bio?: string | null;
  educationLevel?: string | null;
  institutionName?: string | null;
  phone?: string | null;
  email?: string | null;
  gender?: string | null;
  portfolioUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
}

export interface CandidateDiscoveryPage {
  data: CandidateDiscoveryCandidate[];
  count: number;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function isCandidateDiscoveryCandidate(value: unknown): value is CandidateDiscoveryCandidate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.profileId === 'string'
    && typeof candidate.fullName === 'string'
    && typeof candidate.experienceYears === 'number'
    && typeof candidate.availableForWork === 'boolean'
    && Array.isArray(candidate.skills)
    && candidate.skills.every((skill) => Boolean(skill) && typeof skill === 'object'
      && typeof (skill as Record<string, unknown>).name === 'string');
}

export interface AccountProfile {
  user: {
    id: string;
    email: string;
    username: string | null;
    fullName: string;
    firstName: string;
    middleName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    dateOfBirth: string;
    gender: string;
    genderDescription: string;
    country: string | null;
    region: string | null;
    preferredLanguage: string;
    profileVisibility: 'PRIVATE' | 'REGISTERED' | 'PUBLIC';
    showPhone: boolean;
    showEmail: boolean;
    showLocation: boolean;
    showGender: boolean;
    candidateSearchable: boolean;
    employerDiscoverable: boolean;
    createdAt: string;
  };
  role: 'JOB_SEEKER' | 'EMPLOYER' | 'ADMIN';
  roleProfile: Record<string, any>;
}

export interface AccountProfileUpdate {
  firstName: string;
  middleName: string;
  lastName: string;
  username: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  genderDescription: string;
  country: string;
  region: string;
  city: string;
  headline: string;
  bio: string;
  preferredLanguage: string;
  portfolioUrl: string;
  linkedinUrl: string;
  website: string;
  companyName: string;
  industry: string;
  employeeRange: string;
  profileVisibility: 'PRIVATE' | 'REGISTERED' | 'PUBLIC';
  showPhone: boolean;
  showEmail: boolean;
  showLocation: boolean;
  showGender: boolean;
  candidateSearchable: boolean;
  employerDiscoverable: boolean;
}

export const api = {
  async verifyIssuedReport(reportId: string): Promise<{ valid: boolean; verification: PublicReportVerification }> {
    const res = await fetch(`/api/report-verification/${encodeURIComponent(reportId)}`, {
      credentials: 'same-origin',
      headers: getHeaders(false),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'Report verification could not be completed');
    if (!data.verification || typeof data.valid !== 'boolean') throw new Error('The verification service returned an invalid response.');
    return { valid: data.valid, verification: data.verification as PublicReportVerification };
  },

  async getAccountProfile(): Promise<AccountProfile> {
    const res = await fetch('/api/profile/me', { credentials: 'same-origin', headers: getHeaders(false), cache: 'no-store' });
    const data = await safeJson(res, 'Profile could not be loaded');
    return data.data;
  },

  async updateAccountProfile(payload: AccountProfileUpdate): Promise<AccountProfile> {
    const res = await fetch('/api/profile/me', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res, 'Profile could not be saved');
    return data.data;
  },

  async uploadProfileImage(kind: 'avatar' | 'cover', data: string, onProgress?: (progress: number) => void): Promise<{ kind: string; url: string }> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', '/api/profile/me/image');
      request.withCredentials = true;
      request.setRequestHeader('Content-Type', 'application/json');
      request.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onerror = () => reject(new Error('Image upload failed. Check your connection and try again.'));
      request.onload = () => {
        let result: any;
        try {
          result = JSON.parse(request.responseText);
        } catch {
          reject(new Error('The server returned an invalid image response.'));
          return;
        }
        if (request.status < 200 || request.status >= 300 || result?.success === false) {
          reject(new Error(result?.error || `Image upload failed (${request.status}).`));
          return;
        }
        resolve(result.data);
      };
      request.send(JSON.stringify({ kind, data }));
    });
  },

  async removeProfileImage(kind: 'avatar' | 'cover'): Promise<void> {
    const res = await fetch(`/api/profile/me/image/${kind}`, { method: 'DELETE', credentials: 'same-origin', headers: getHeaders(false) });
    await safeJson(res, 'Image could not be removed');
  },

  // Authentication
  async register(payload: { email: string; password: string; fullName: string; role: RegistrationRole; phone?: string; companyOrSchool?: string }) {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res, 'Registration failed');
    if (!data.success) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async login(payload: { email: string; password: string }) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res, 'Login failed');
    if (!data.success) throw new Error(data.error || 'Login failed');
    return data;
  },

  async completeMfaLogin(challengeId: string, code: string) {
    const res = await fetch('/api/auth/mfa/login/verify', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({ challengeId, code }),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'MFA verification failed');
    if (!data.success) throw new Error(data.error || 'MFA verification failed');
    return data;
  },

  async getMfaStatus(): Promise<{ totpEnabled: boolean; enabledAt: string | null; recoveryCodesRemaining: number }> {
    const res = await fetch('/api/auth/mfa', { headers: getHeaders(false), cache: 'no-store' });
    const data = await safeJson(res, 'MFA status could not be loaded');
    return data.data;
  },

  async beginTotpEnrollment(currentPassword: string): Promise<{ secret: string; otpauthUrl: string; issuer: string; account: string }> {
    const res = await fetch('/api/auth/mfa/totp/enroll', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({ currentPassword }),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'Authenticator enrollment could not be started');
    return data.data;
  },

  async confirmTotpEnrollment(code: string): Promise<{ enabled: boolean; recoveryCodes: string[] }> {
    const res = await fetch('/api/auth/mfa/totp/confirm', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({ code }),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'Authenticator could not be verified');
    return data.data;
  },

  async disableTotp(currentPassword: string, code: string): Promise<void> {
    const res = await fetch('/api/auth/mfa/totp/disable', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({ currentPassword, code }),
      cache: 'no-store',
    });
    await safeJson(res, 'Authenticator MFA could not be disabled');
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });
    return safeJson(res, 'Password recovery request failed');
  },

  async resendPasswordResetCode(email: string): Promise<{ message: string }> {
    const res = await fetch('/api/auth/resend-reset-otp', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });
    return safeJson(res, 'Reset code request failed');
  },

  async resetPassword(payload: { email: string; code: string; newPassword: string; confirmPassword: string }): Promise<{ message: string }> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    return safeJson(res, 'Password reset failed');
  },

  async getMe() {
    const res = await fetch('/api/auth/me', {
      credentials: 'same-origin',
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Authentication session check failed');
    if (!data.success) throw new Error(data.error || 'Authentication session invalid');
    return data;
  },

  async getEmailVerificationStatus(): Promise<{ email: string; expiresAt: string; resendAvailableAt: string }> {
    const res = await fetch('/api/auth/email-verification', {
      credentials: 'same-origin',
      headers: getHeaders(false),
      cache: 'no-store'
    });
    return safeJson(res, 'Email verification status could not be loaded');
  },

  async requestEmailVerification(email: string): Promise<{ message: string }> {
    const res = await fetch('/api/auth/email-verification/request', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getHeaders(),
      body: JSON.stringify({ email }),
      cache: 'no-store',
    });
    return safeJson(res, 'A verification email could not be requested');
  },

  async resendEmailVerificationCode(): Promise<{ message: string; resendAvailableAt: string; expiresAt: string }> {
    const res = await fetch('/api/auth/email-verification/resend', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getHeaders(false)
    });
    return safeJson(res, 'A new verification code could not be sent');
  },

  async verifyEmailCode(code: string): Promise<{ user: { id: string; email: string; fullName: string; role: Role; emailVerified: boolean } }> {
    const res = await fetch('/api/auth/email-verification/verify', {
      method: 'POST',
      credentials: 'same-origin',
      headers: getHeaders(),
      body: JSON.stringify({ code })
    });
    return safeJson(res, 'Email verification failed');
  },

  async logout() {
    const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    await safeJson(res, 'Sign out failed');
  },

  async changePassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    return safeJson(res, 'Password update failed');
  },

  // System diagnostics
  async getSystemStatus(): Promise<SystemStatus> {
    const res = await fetch('/api/system/status');
    const data = await safeJson(res, 'System status check failed');
    return data.data;
  },

  // Jobs
  async getJobs(params?: { q?: string; city?: string; type?: string; skill?: string; minSalary?: number }): Promise<Job[]> {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.city) query.set('city', params.city);
    if (params?.type) query.set('type', params.type);
    if (params?.skill) query.set('skill', params.skill);
    if (params?.minSalary) query.set('minSalary', params.minSalary.toString());

    const res = await fetch(`/api/jobs?${query.toString()}`, {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Fetch jobs failed');
    return data.data || [];
  },

  async getJobById(id: string): Promise<Job> {
    const res = await fetch(`/api/jobs/${id}`, {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Job retrieval failed');
    if (!data.success) throw new Error(data.error || 'Job not found');
    return data.data;
  },

  async createJob(jobData: any): Promise<any> {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(jobData)
    });
    const data = await safeJson(res, 'Job creation failed');
    if (!data.success) throw new Error(data.error || 'Failed to create job');
    return data.data;
  },

  async updateJob(jobId: string, jobData: any): Promise<void> {
    const res = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(jobData),
    });
    const data = await safeJson(res, 'Job update failed');
    if (!data.success) throw new Error(data.error || 'Failed to update job');
  },

  async updateJobStatus(jobId: string, status: 'ACTIVE' | 'CLOSED' | 'PAUSED'): Promise<any> {
    const res = await fetch(`/api/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status })
    });
    const data = await safeJson(res, 'Update job status failed');
    if (!data.success) throw new Error(data.error || 'Failed to update job status');
    return data.data;
  },

  async analyzeSkillGap(jobId: string, weights?: { skillWeight?: number; experienceWeight?: number }): Promise<SkillGapAnalysisResult> {
    const res = await fetch(`/api/jobs/${jobId}/analyze-gap`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(weights || {})
    });
    const data = await safeJson(res, 'Analyze skill gap failed');
    if (!data.success) throw new Error(data.error || 'Failed to analyze gap');
    return data.data;
  },

  async applyForJob(jobId: string, coverNote?: string): Promise<{ applicationId: string; matchScore: number }> {
    const res = await fetch(`/api/jobs/${jobId}/apply`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ coverNote })
    });
    const data = await safeJson(res, 'Apply for job failed');
    if (!data.success) throw new Error(data.error || 'Failed to apply');
    return data.data;
  },

  async saveJob(jobId: string): Promise<void> {
    const res = await fetch(`/api/jobs/${jobId}/save`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await safeJson(res, 'Save job failed');
    if (!data.success) throw new Error(data.error || 'Failed to save job');
  },

  async unsaveJob(jobId: string): Promise<void> {
    const res = await fetch(`/api/jobs/${jobId}/save`, {
      method: 'DELETE',
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Unsave job failed');
    if (!data.success) throw new Error(data.error || 'Failed to remove saved job');
  },

  // Skills
  async getSkills(): Promise<Skill[]> {
    const res = await fetch('/api/system/skills');
    const data = await safeJson(res, 'Get skills failed');
    return requireArray<Skill>(data.data, 'Get skills');
  },

  // Candidate Profile
  async getCandidateProfile(): Promise<JobSeekerProfile> {
    const res = await fetch('/api/candidates/me', {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Get candidate profile failed');
    return data.data;
  },

  async getCandidateSkills(): Promise<JobSeekerSkill[]> {
    const res = await fetch('/api/candidates/me/skills', {
      headers: getHeaders(false),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'Candidate skills could not be loaded');
    return requireArray<JobSeekerSkill>(data.data, 'Candidate skills');
  },

  async updateCandidateProfile(updates: Partial<JobSeekerProfile>): Promise<void> {
    const res = await fetch('/api/candidates/me', {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
    const data = await safeJson(res, 'Update profile failed');
    if (!data.success) throw new Error(data.error || 'Failed to update profile');
  },

  async addCandidateSkill(skillName: string, category: string, level: SkillLevel, yearsExperience = 0): Promise<void> {
    const res = await fetch('/api/candidates/me/skills', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ skillName, category, proficiencyLevel: level, yearsExperience })
    });
    const data = await safeJson(res, 'Add skill failed');
    if (!data.success) throw new Error(data.error || 'Failed to add skill');
  },

  async updateCandidateSkill(skillId: string, updates: { proficiencyLevel?: SkillLevel; yearsExperience?: number }): Promise<void> {
    const res = await fetch(`/api/candidates/me/skills/${encodeURIComponent(skillId)}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    await safeJson(res, 'Candidate skill could not be updated');
  },

  async removeCandidateSkill(skillId: string): Promise<void> {
    const res = await fetch(`/api/candidates/me/skills/${skillId}`, {
      method: 'DELETE',
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Remove skill failed');
    if (!data.success) throw new Error(data.error || 'Failed to remove skill');
  },

  async getCandidateSkillAssessments(): Promise<CandidateSkillAssessment[]> {
    const res = await fetch('/api/candidates/me/skills/assessments', {
      headers: getHeaders(false),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'Assessment history could not be loaded');
    return requireArray<CandidateSkillAssessment>(data.data, 'Assessment history');
  },

  async getCandidateSkillAssessmentQuestions(skillRecordId: string): Promise<CandidateSkillAssessmentQuestion[]> {
    const res = await fetch(`/api/candidates/me/skills/${encodeURIComponent(skillRecordId)}/assessment`, {
      headers: getHeaders(false),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'Assessment questions could not be loaded');
    return requireArray<CandidateSkillAssessmentQuestion>(data.data, 'Assessment questions');
  },

  async submitCandidateSkillAssessment(
    skillRecordId: string,
    answers: Array<{ questionId: string; selectedOption: number }>,
  ): Promise<CandidateSkillAssessmentResult> {
    const res = await fetch(`/api/candidates/me/skills/${encodeURIComponent(skillRecordId)}/assessments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ answers }),
    });
    const data = await safeJson(res, 'Assessment could not be submitted');
    return data.data as CandidateSkillAssessmentResult;
  },

  async getApplications(): Promise<Application[]> {
    const res = await fetch('/api/candidates/me/applications', {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Get applications failed');
    return requireArray<Application>(data.data, 'Get applications');
  },

  async getCandidateMessageThreads(): Promise<{ unreadCount: number; threads: ApplicationMessageThread[] }> {
    const res = await fetch('/api/messages/candidate/threads', { headers: getHeaders(false), cache: 'no-store' });
    const data = await safeJson(res, 'Messages could not be loaded');
    const result: unknown = data.data;
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Candidate messages returned an invalid response.');
    }
    const payload = result as Record<string, unknown>;
    const unreadCount = payload.unreadCount;
    if (typeof unreadCount !== 'number' || !Number.isSafeInteger(unreadCount) || unreadCount < 0 || !Array.isArray(payload.threads)) {
      throw new Error('Candidate messages returned an invalid response.');
    }
    return {
      unreadCount,
      threads: requireArray<ApplicationMessageThread>(payload.threads, 'Candidate messages'),
    };
  },

  async getCandidateConversation(applicationId: string): Promise<{ thread: ApplicationMessageThread; messages: ApplicationMessage[] }> {
    const res = await fetch(`/api/messages/candidate/threads/${encodeURIComponent(applicationId)}`, { headers: getHeaders(false), cache: 'no-store' });
    const data = await safeJson(res, 'Conversation could not be loaded');
    return data.data;
  },

  async replyToEmployer(applicationId: string, body: string): Promise<void> {
    const res = await fetch(`/api/messages/candidate/threads/${encodeURIComponent(applicationId)}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ body }),
    });
    await safeJson(res, 'Reply could not be sent');
  },

  async respondToInterviewInvitation(applicationId: string, messageId: string, response: 'ACCEPTED' | 'DECLINED'): Promise<void> {
    const res = await fetch(`/api/messages/candidate/threads/${encodeURIComponent(applicationId)}/respond/${encodeURIComponent(messageId)}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ response }),
    });
    await safeJson(res, 'Interview response could not be sent');
  },

  async getSavedJobs(): Promise<any[]> {
    const res = await fetch('/api/candidates/me/saved-jobs', {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Get saved jobs failed');
    return requireArray(data.data, 'Get saved jobs');
  },

  async getRecommendedJobs(): Promise<any[]> {
    const res = await fetch('/api/candidates/me/recommendations', {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Get recommended jobs failed');
    return requireArray(data.data, 'Get recommended jobs');
  },

  async getLearningPath(): Promise<any> {
    const res = await fetch('/api/candidates/me/learning-path', {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Get learning path failed');
    return data.data;
  },

  // Employers
  async getEmployers(): Promise<EmployerProfile[]> {
    const res = await fetch('/api/employers');
    const data = await safeJson(res, 'Get employers failed');
    return data.data || [];
  },

  async getEmployerMe(): Promise<any> {
    const res = await fetch('/api/employers/me', {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Get employer profile failed');
    return data.data;
  },

  async getEmployerAnalytics(): Promise<any> {
    const res = await fetch('/api/employers/me/analytics', {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Get employer analytics failed');
    if (!data.success) throw new Error(data.error || 'Failed to fetch analytics');
    return data.data;
  },

  async getEmployerReports(): Promise<Array<{ type: EmployerReportType; label: string; dateBasis: string }>> {
    const res = await fetch('/api/employers/me/reports', {
      headers: getHeaders(false),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'Employer reports could not be loaded');
    if (!Array.isArray(data.data)) throw new Error('Employer reports returned an invalid response.');
    return data.data;
  },

  async getEmployerReport(
    type: EmployerReportType,
    filters: { startDate?: string; endDate?: string; page?: number; pageSize?: number } = {},
  ): Promise<EmployerReport> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') params.set(key, String(value));
    });
    const res = await fetch(`/api/employers/me/reports/${type}/preview?${params}`, {
      headers: getHeaders(false),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'Employer report preview could not be loaded');
    if (!data.data || data.data.type !== type || !Array.isArray(data.data.rows) || !Array.isArray(data.data.columns)) {
      throw new Error('Employer report preview returned an invalid response.');
    }
    return data.data as EmployerReport;
  },

  async exportEmployerReport(
    type: EmployerReportType,
    filters: { startDate?: string; endDate?: string } = {},
    format: 'csv' | 'pdf' = 'csv',
  ): Promise<{ blob: Blob; filename: string; truncated: boolean; recordCount: number }> {
    const params = new URLSearchParams({ format });
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const res = await fetch(`/api/employers/me/reports/${type}/export?${params}`, {
      headers: getHeaders(false),
      cache: 'no-store',
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      throw new Error(payload?.error || 'Employer report export failed. Please retry.');
    }
    const disposition = res.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="([^"]+)"/i)?.[1] || `SKILLBRIDGE_ET_Employer_${type}.${format}`;
    return {
      blob: await res.blob(),
      filename,
      truncated: res.headers.get('x-report-truncated') === 'true',
      recordCount: Number(res.headers.get('x-report-record-count') || 0),
    };
  },

  async submitVerification(tinNumber: string, businessLicenseNo: string): Promise<any> {
    const res = await fetch('/api/employers/me/verify', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ tinNumber, businessLicenseNo })
    });
    const data = await safeJson(res, 'Submit verification failed');
    if (!data.success) throw new Error(data.error || 'Failed to submit verification');
    return data;
  },

  async getEmployerVerificationDocuments(): Promise<EmployerVerificationDocument[]> {
    const res = await fetch('/api/employers/me/verification/documents', {
      headers: getHeaders(false),
      cache: 'no-store',
    });
    const data = await safeJson(res, 'Verification documents could not be loaded');
    return data.data || [];
  },

  async uploadEmployerVerificationDocument(payload: {
    category: EmployerVerificationDocument['category'];
    originalFilename: string;
    contentType: string;
    data: string;
  }): Promise<EmployerVerificationDocument> {
    const res = await fetch('/api/employers/me/verification/documents', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res, 'Verification document could not be uploaded');
    return data.data;
  },

  async getEmployerApplications(): Promise<Application[]> {
    const res = await fetch('/api/employers/me/applications', {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Get employer applications failed');
    return data.data || [];
  },

  async searchEmployerCandidates(filters: CandidateDiscoveryFilters = {}): Promise<CandidateDiscoveryPage> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const query = params.toString();
    const res = await fetch(`/api/employers/me/candidates${query ? `?${query}` : ''}`, {
      headers: getHeaders(false),
      cache: 'no-store',
    });
    const payload = await safeJson(res, 'Candidate search could not be loaded');
    const result: unknown = payload;
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Candidate search returned an invalid response.');
    }
    const page = result as Record<string, unknown>;
    const { count, total, page: currentPage, pageSize, totalPages } = page;
    if (
      !Array.isArray(page.data)
      || !page.data.every(isCandidateDiscoveryCandidate)
      || typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0
      || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0
      || typeof currentPage !== 'number' || !Number.isSafeInteger(currentPage) || currentPage < 1
      || typeof pageSize !== 'number' || !Number.isSafeInteger(pageSize) || pageSize < 1
      || typeof totalPages !== 'number' || !Number.isSafeInteger(totalPages) || totalPages < 0
    ) {
      throw new Error('Candidate search returned an invalid response.');
    }
    return {
      data: page.data,
      count,
      total,
      page: currentPage,
      pageSize,
      totalPages,
    };
  },

  async getEmployerCandidateDetails(profileId: string): Promise<CandidateDiscoveryCandidate> {
    const res = await fetch(`/api/employers/me/candidates/${encodeURIComponent(profileId)}`, {
      headers: getHeaders(false),
      cache: 'no-store',
    });
    const payload = await safeJson(res, 'Candidate profile could not be loaded');
    const candidate: unknown = payload.data;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error('Candidate profile returned an invalid response.');
    }
    const profile = candidate as Record<string, unknown>;
    if (!isCandidateDiscoveryCandidate(candidate)) {
      throw new Error('Candidate profile returned an invalid response.');
    }
    return candidate;
  },

  async getEmployerMessageThreads(): Promise<{ unreadCount: number; threads: ApplicationMessageThread[] }> {
    const res = await fetch('/api/messages/employer/threads', { headers: getHeaders(false), cache: 'no-store' });
    const data = await safeJson(res, 'Messages could not be loaded');
    return data.data;
  },

  async getEmployerConversation(applicationId: string): Promise<{ thread: ApplicationMessageThread; messages: ApplicationMessage[] }> {
    const res = await fetch(`/api/messages/employer/threads/${encodeURIComponent(applicationId)}`, { headers: getHeaders(false), cache: 'no-store' });
    const data = await safeJson(res, 'Conversation could not be loaded');
    return data.data;
  },

  async sendEmployerMessage(applicationId: string, payload: {
    kind: Exclude<ApplicationMessageKind, 'APPLICATION_UPDATE'>;
    subject?: string;
    body: string;
    dueAt?: string;
  }): Promise<void> {
    const res = await fetch(`/api/messages/employer/threads/${encodeURIComponent(applicationId)}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    await safeJson(res, 'Message could not be sent');
  },

  async sendEmployerBulkMessage(payload: {
    requestId: string;
    applicationIds: string[];
    kind: Exclude<ApplicationMessageKind, 'APPLICATION_UPDATE' | 'SHORTLISTED'>;
    subject?: string;
    body: string;
    dueAt?: string;
  }): Promise<{ duplicate: boolean; recipientCount: number }> {
    const res = await fetch('/api/messages/employer/bulk', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await safeJson(res, 'Candidate update could not be sent');
    return data.data;
  },

  async updateApplicationStage(applicationId: string, status: string, statusNotes?: string): Promise<void> {
    const res = await fetch(`/api/employers/me/applications/${applicationId}/status`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, statusNotes })
    });
    const data = await safeJson(res, 'Update application status failed');
    if (!data.success) throw new Error(data.error || 'Failed to update application status');
  },

  // Account & Trust Settings
  async updateUserAccount(payload: { fullName?: string; phone?: string }): Promise<void> {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await safeJson(res, 'Update account failed');
    if (!data.success) throw new Error(data.error || 'Failed to update account');
  },

  async deleteUserAccount(password: string): Promise<void> {
    const res = await fetch('/api/auth/me', {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ password })
    });
    const data = await safeJson(res, 'Delete account failed');
    if (!data.success) throw new Error(data.error || 'Failed to delete account');
  },

  // Admin Desk
  async getAdminManagementOptions(): Promise<AdminManagementOptions> {
    const res = await fetch('/api/admin/manage-options', {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Management options could not be loaded');
    return data.data;
  },

  async getAdminManagedRecords(
    entity: AdminManagementEntity,
    filters: { page: number; pageSize: number; search?: string; includeArchived?: boolean },
  ): Promise<AdminPageResult<Record<string, unknown>>> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const res = await fetch(`/api/admin/manage/${entity}?${query}`, {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Managed records could not be loaded');
    return { count: data.count, data: data.data || [], page: data.page, pageSize: data.pageSize, totalPages: data.totalPages };
  },

  async createAdminManagedRecord(entity: AdminManagementEntity, payload: Record<string, unknown>): Promise<void> {
    const res = await fetch(`/api/admin/manage/${entity}`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    await safeJson(res, 'Record could not be created');
  },

  async updateAdminManagedRecord(entity: AdminManagementEntity, id: string, payload: Record<string, unknown>): Promise<void> {
    const res = await fetch(`/api/admin/manage/${entity}/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    await safeJson(res, 'Record could not be updated');
  },

  async archiveAdminManagedRecord(entity: AdminManagementEntity, id: string): Promise<void> {
    const res = await fetch(`/api/admin/manage/${entity}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getHeaders(false),
    });
    await safeJson(res, 'Record could not be archived');
  },

  async restoreAdminManagedRecord(entity: AdminManagementEntity, id: string): Promise<void> {
    const res = await fetch(`/api/admin/manage/${entity}/${encodeURIComponent(id)}/restore`, {
      method: 'POST',
      headers: getHeaders(false),
    });
    await safeJson(res, 'Record could not be restored');
  },

  async getAdminVerifications(filters: {
    page: number;
    pageSize: number;
    search?: string;
    status?: string;
    emailStatus?: 'verified' | 'unverified' | 'action_required';
    sort?: 'createdAt' | 'companyName' | 'email' | 'status';
    direction?: 'asc' | 'desc';
  }): Promise<AdminPageResult<any>> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const res = await fetch(`/api/admin/verifications?${query}`, {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Get verifications failed');
    return { count: data.count, data: data.data || [], page: data.page, pageSize: data.pageSize, totalPages: data.totalPages };
  },

  async getAdminMfaAdoptionSummary(): Promise<Array<{ role: string; totalAccounts: number; mfaEnabled: number }>> {
    const res = await fetch('/api/admin/security/mfa-summary', {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'MFA adoption summary could not be loaded');
    return data.data ?? [];
  },

  async getAdminEmployerVerificationSummary(): Promise<AdminEmployerVerificationSummary> {
    const res = await fetch('/api/admin/verifications/summary', {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Employer verification summary could not be loaded');
    return data.data;
  },

  async getAdminEmployerVerificationDocuments(employerId: string): Promise<EmployerVerificationDocument[]> {
    const res = await fetch(`/api/admin/verifications/employers/${encodeURIComponent(employerId)}/documents`, {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Verification documents could not be loaded');
    return data.data || [];
  },

  async getAdminEmployerVerificationHistory(employerId: string): Promise<EmployerVerificationHistoryItem[]> {
    const res = await fetch(`/api/admin/verifications/employers/${encodeURIComponent(employerId)}/history`, {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Verification history could not be loaded');
    return data.data || [];
  },

  async reviewEmployerVerificationDocument(
    documentId: string,
    status: EmployerVerificationDocument['status'],
    reviewNotes: string,
  ): Promise<void> {
    const res = await fetch(`/api/admin/verifications/documents/${encodeURIComponent(documentId)}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, reviewNotes }),
    });
    await safeJson(res, 'Verification document review could not be recorded');
  },

  async getAdminEmployerVerificationDocumentFile(
    employerId: string,
    documentId: string,
    disposition: 'inline' | 'attachment',
  ): Promise<Blob> {
    const res = await fetch(
      `/api/admin/verifications/employers/${encodeURIComponent(employerId)}/documents/${encodeURIComponent(documentId)}?disposition=${disposition}`,
      { headers: getHeaders(false), cache: 'no-store' },
    );
    if (!res.ok) {
      await safeJson(res, 'Verification document could not be accessed');
      throw new Error('Verification document could not be accessed.');
    }
    return res.blob();
  },

  async reviewVerification(id: string, status: 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED', reviewNotes: string): Promise<any> {
    const res = await fetch(`/api/admin/verifications/${id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, reviewNotes })
    });
    const data = await safeJson(res, 'Review verification failed');
    if (!data.success) throw new Error(data.error || 'Failed to review verification');
    return data;
  },

  async getAdminUsers(filters: {
    page: number;
    pageSize: number;
    search?: string;
    role?: string;
    status?: string;
    emailStatus?: 'verified' | 'unverified' | 'action_required';
  }): Promise<AdminPageResult<any> & { summary: AdminUserSummary }> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const res = await fetch(`/api/admin/users?${query}`, {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Get users failed');
    return {
      count: data.count,
      data: data.data || [],
      summary: data.summary,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: data.totalPages,
    };
  },

  async getAdminUserEmailVerificationDetails(userId: string): Promise<any> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email-verification`, {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Get account verification details failed');
    return data.data;
  },

  async verifyAdminUserEmail(userId: string, reason: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email-verification/verify`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    await safeJson(res, 'Email verification decision could not be recorded');
  },

  async resendAdminUserVerificationEmail(userId: string): Promise<{ message: string; expiresAt: string }> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email-verification/resend`, {
      method: 'POST',
      headers: getHeaders(false),
    });
    const data = await safeJson(res, 'Verification email could not be sent');
    return { message: data.message, expiresAt: data.expiresAt };
  },

  async moderateUser(userId: string, isActive: boolean, reason: string): Promise<void> {
    const res = await fetch(`/api/admin/users/${userId}/moderate`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ isActive, reason })
    });
    const data = await safeJson(res, 'Moderate user failed');
    if (!data.success) throw new Error(data.error || 'Failed to moderate user');
  },

  async manuallyVerifyAdminEmployerEmail(employerId: string, reason: string): Promise<void> {
    const res = await fetch(`/api/admin/verifications/${encodeURIComponent(employerId)}/email/verify`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ reason }),
    });
    await safeJson(res, 'Email verification decision could not be recorded');
  },

  async resendAdminEmployerVerificationEmail(employerId: string): Promise<{ message: string; expiresAt: string }> {
    const res = await fetch(`/api/admin/verifications/${encodeURIComponent(employerId)}/email/resend`, {
      method: 'POST',
      headers: getHeaders(false),
    });
    const data = await safeJson(res, 'Verification email could not be sent');
    return { message: data.message, expiresAt: data.expiresAt };
  },

  async getAdminJobs(filters: { page: number; pageSize: number; search?: string; status?: string }): Promise<AdminPageResult<any>> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const res = await fetch(`/api/admin/jobs?${query}`, {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Get jobs failed');
    return { count: data.count, data: data.data || [], page: data.page, pageSize: data.pageSize, totalPages: data.totalPages };
  },

  async moderateAdminJob(jobId: string, status: 'ACTIVE' | 'PAUSED' | 'CLOSED', reason: string): Promise<void> {
    const res = await fetch(`/api/admin/jobs/${jobId}/moderate`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ status, reason })
    });
    const data = await safeJson(res, 'Job moderation failed');
    if (!data.success) throw new Error(data.error || 'Failed to moderate job');
  },

  async getAdminAuditLogs(filters: { page: number; pageSize: number; search?: string; action?: string; from?: string; to?: string }): Promise<AdminPageResult<any>> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, String(value));
    });
    const res = await fetch(`/api/admin/audit-logs?${query}`, {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Get audit logs failed');
    return { count: data.count, data: data.data || [], page: data.page, pageSize: data.pageSize, totalPages: data.totalPages };
  },

  async getAdminMetrics(): Promise<any> {
    const res = await fetch('/api/admin/metrics', {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Get metrics failed');
    return data.data;
  },

  async getAdminDiagnostics(): Promise<SystemStatus> {
    const res = await fetch('/api/admin/diagnostics', {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Get diagnostics failed');
    return data.data;
  },

  async getAdminReport(filters: {
    type: AdminReportType;
    startDate?: string;
    endDate?: string;
    status?: string;
    role?: string;
    category?: string;
    actor?: string;
    eventType?: string;
    outcome?: string;
    columns?: string[];
  }): Promise<{ report: AdminReport; snapshotId: string }> {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') query.set(key, Array.isArray(value) ? value.join(',') : String(value));
    });
    const res = await fetch(`/api/admin/reports?${query}`, {
      headers: getHeaders(false),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    const data = await safeJson(res, 'Report could not be generated');
    return { report: data.data, snapshotId: data.snapshotId };
  },

  async exportAdminReport(snapshotId: string, format: AdminReportFormat): Promise<{ blob: Blob; filename: string }> {
    const res = await fetch('/api/admin/reports/export', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ snapshotId, format }),
      cache: 'no-store',
      signal: adminRequestTimeout(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || 'Report export failed. Please retry.');
    }
    const disposition = res.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="([^"]+)"/i)?.[1] || `SKILLBRIDGE_ET_Report.${format}`;
    return { blob: await res.blob(), filename };
  },

  // Evaluations
  async getEvaluations(): Promise<PerformanceEvaluation[]> {
    const res = await fetch('/api/evaluations', {
      headers: getHeaders(false)
    });
    const data = await safeJson(res, 'Get evaluations failed');
    return data.data || [];
  },

  async submitEvaluation(evaluationData: any): Promise<PerformanceEvaluation> {
    const res = await fetch('/api/evaluations', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(evaluationData)
    });
    const data = await safeJson(res, 'Submit evaluation failed');
    if (!data.success) throw new Error(data.error || 'Failed to submit evaluation');
    return data.data;
  },

  // AI Services
  async getAISkillAdvisor(payload: {
    targetJobTitle: string;
    jobId?: string;
  }): Promise<{ success: boolean; aiGenerated: boolean; provider?: 'openai' | 'gemini'; fallbackUsed?: boolean; data: any; message?: string }> {
    const res = await fetch('/api/ai/skill-gap-advisor', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    return await safeJson(res, 'Skill gap advisor failed');
  },

  async analyzeCandidateCv(payload: {
    cvText: string;
    jobId?: string;
    targetJobTitle?: string;
  }): Promise<{ success: boolean; aiGenerated: boolean; provider?: 'openai' | 'gemini'; fallbackUsed?: boolean; data: any; message?: string }> {
    const res = await fetch('/api/ai/cv-analysis', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    return await safeJson(res, 'CV analysis failed');
  },

  async enhanceJobWithAI(payload: {
    title: string;
    rawDescription: string;
    industry?: string;
  }): Promise<{ success: boolean; aiGenerated: boolean; provider?: 'openai' | 'gemini'; fallbackUsed?: boolean; data: any; message?: string }> {
    const res = await fetch('/api/ai/job-enhancer', {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    return await safeJson(res, 'Job enhancer failed');
  },

  // SKILLBRIDGE AI NEXUS Endpoints
  async getNexusConversations(): Promise<any[]> {
    const res = await fetch('/api/ai/nexus/conversations', {
      headers: getHeaders(false),
      credentials: 'same-origin',
    });
    const data = await safeJson(res, 'Get AI conversations failed');
    return data.data || [];
  },

  async getNexusConversation(id: string): Promise<any> {
    const res = await fetch(`/api/ai/nexus/conversations/${id}`, {
      headers: getHeaders(false),
      credentials: 'same-origin',
    });
    const data = await safeJson(res, 'Load AI conversation failed');
    if (!data.success) throw new Error(data.error || 'Failed to load conversation');
    return data.data;
  },

  async queryNexus(payload: {
    message: string;
    conversationId?: string;
    contextRoute?: string;
    pageContext?: any;
  }): Promise<{ success: boolean; conversationId: string; message: any }> {
    const res = await fetch('/api/ai/nexus/query', {
      method: 'POST',
      headers: getHeaders(true),
      credentials: 'same-origin',
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    const data = await safeJson(res, 'AI Nexus query failed');
    if (!data.success) throw new Error(data.error || 'AI Nexus query failed');
    return data;
  },

  async deleteNexusConversation(id: string): Promise<void> {
    const res = await fetch(`/api/ai/nexus/conversations/${id}`, {
      method: 'DELETE',
      headers: getHeaders(false),
      credentials: 'same-origin',
    });
    const data = await safeJson(res, 'Delete AI conversation failed');
    if (!data.success) throw new Error(data.error || 'Failed to delete conversation');
  }
};
