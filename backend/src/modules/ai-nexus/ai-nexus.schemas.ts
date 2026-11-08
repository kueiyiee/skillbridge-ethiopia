import { z } from 'zod';

export const aiSkillAdvisorSchema = z.object({
  targetJobTitle: z.string().trim().min(2).max(150),
  jobId: z.string().min(1).optional(),
}).strict();

export const jobEnhancerSchema = z.object({
  title: z.string().trim().min(3).max(150),
  rawDescription: z.string().trim().min(20).max(5000),
  industry: z.string().trim().max(120).optional(),
}).strict();

export const nexusQuerySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().max(191).optional(),
  turnId: z.string().uuid().optional(),
  contextRoute: z.string().max(80).optional(),
  pageContext: z.object({ selectedJobId: z.string().max(191).optional() }).strict().optional(),
});

export const cvAnalysisRequestSchema = z.object({
  cvText: z.string().trim().min(80).max(12000),
  jobId: z.string().max(191).optional(),
  targetJobTitle: z.string().trim().min(2).max(150).optional(),
}).strict();

export const nexusResponseSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  actionType: z.enum(['JOB_MATCH', 'SKILL_GAP', 'INTERVIEW_PREP', 'CANDIDATE_SEARCH', 'JD_OPTIMIZE', 'PLATFORM_METRICS', 'AUDIT_SUMMARY']),
  suggestedActions: z.array(z.string().trim().min(1).max(100)).max(4),
  jobIds: z.array(z.string().max(191)).max(6),
});

export const skillGapOutputSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  readinessRating: z.enum(['Needs Acceleration', 'Developing', 'Ready']),
  marketContextEthiopia: z.string().trim().min(1).max(500),
  weeklyPlan: z.array(z.object({
    week: z.number().int().min(1).max(4),
    theme: z.string().trim().min(1).max(120),
    targetSkill: z.string().trim().min(1).max(120),
    practicalProject: z.string().trim().min(1).max(500),
    recommendedResources: z.array(z.string().trim().max(120)).max(3),
  }).strict()).max(4),
  interviewTips: z.array(z.string().trim().min(1).max(240)).max(5),
}).strict();

export const cvAnalysisOutputSchema = z.object({
  summary: z.string().trim().min(1).max(1200),
  strengths: z.array(z.object({
    observation: z.string().trim().min(1).max(240),
    evidence: z.string().trim().min(1).max(240),
  }).strict()).max(5),
  skillsEvidence: z.array(z.object({
    skill: z.string().trim().min(1).max(120),
    evidence: z.string().trim().min(1).max(240),
  }).strict()).max(12),
  recommendations: z.array(z.object({
    focusSkill: z.string().trim().min(1).max(120),
    action: z.string().trim().min(1).max(300),
    evidence: z.string().trim().min(1).max(240),
  }).strict()).max(5),
  missingRequirements: z.array(z.string().trim().min(1).max(120)).max(12),
}).strict();

export const jobEnhancerOutputSchema = z.object({
  enhancedSummary: z.string().trim().min(1).max(2000),
  suggestedSkills: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80),
    weight: z.number().int().min(1).max(5),
    isMandatory: z.boolean(),
    requiredLevel: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
  }).strict()).max(20),
  clarifiedResponsibilities: z.array(z.string().trim().min(1).max(300)).max(12),
  fairHiringAdvice: z.string().trim().min(1).max(500),
}).strict();

export const nexusResponseJsonSchema = {
  type: 'object',
  required: ['content', 'actionType', 'suggestedActions', 'jobIds'],
  properties: {
    content: { type: 'string' },
    actionType: { type: 'string', enum: ['JOB_MATCH', 'SKILL_GAP', 'INTERVIEW_PREP', 'CANDIDATE_SEARCH', 'JD_OPTIMIZE', 'PLATFORM_METRICS', 'AUDIT_SUMMARY'] },
    suggestedActions: { type: 'array', items: { type: 'string' } },
    jobIds: { type: 'array', items: { type: 'string' } },
  },
};

export const skillGapOutputJsonSchema = {
  type: 'object',
  required: ['summary', 'readinessRating', 'marketContextEthiopia', 'weeklyPlan', 'interviewTips'],
  properties: {
    summary: { type: 'string' },
    readinessRating: { type: 'string', enum: ['Needs Acceleration', 'Developing', 'Ready'] },
    marketContextEthiopia: { type: 'string' },
    weeklyPlan: {
      type: 'array', items: { type: 'object', required: ['week', 'theme', 'targetSkill', 'practicalProject', 'recommendedResources'],
        properties: { week: { type: 'integer', minimum: 1, maximum: 4 }, theme: { type: 'string' }, targetSkill: { type: 'string' }, practicalProject: { type: 'string' }, recommendedResources: { type: 'array', items: { type: 'string' } } } },
    },
    interviewTips: { type: 'array', items: { type: 'string' } },
  },
};

export const cvAnalysisOutputJsonSchema = {
  type: 'object',
  required: ['summary', 'strengths', 'skillsEvidence', 'recommendations', 'missingRequirements'],
  properties: {
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'object', required: ['observation', 'evidence'], properties: { observation: { type: 'string' }, evidence: { type: 'string' } } } },
    skillsEvidence: { type: 'array', items: { type: 'object', required: ['skill', 'evidence'], properties: { skill: { type: 'string' }, evidence: { type: 'string' } } } },
    recommendations: { type: 'array', items: { type: 'object', required: ['focusSkill', 'action', 'evidence'], properties: { focusSkill: { type: 'string' }, action: { type: 'string' }, evidence: { type: 'string' } } } },
    missingRequirements: { type: 'array', items: { type: 'string' } },
  },
};

export const jobEnhancerOutputJsonSchema = {
  type: 'object',
  required: ['enhancedSummary', 'suggestedSkills', 'clarifiedResponsibilities', 'fairHiringAdvice'],
  properties: {
    enhancedSummary: { type: 'string' },
    suggestedSkills: { type: 'array', items: { type: 'object', required: ['name', 'category', 'weight', 'isMandatory', 'requiredLevel'], properties: { name: { type: 'string' }, category: { type: 'string' }, weight: { type: 'integer', minimum: 1, maximum: 5 }, isMandatory: { type: 'boolean' }, requiredLevel: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] } } } },
    clarifiedResponsibilities: { type: 'array', items: { type: 'string' } },
    fairHiringAdvice: { type: 'string' },
  },
};
