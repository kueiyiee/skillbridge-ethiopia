import { calculateJobMatch } from '../jobs';
import { assertProfileExists, assertSkillWasRemoved } from './candidates.policy';
import {
  addCandidateSkill,
  findCandidateProfile,
  getCandidateProfile,
  listCandidateSkills,
  listCandidateSkillAssessments,
  listCandidateSkillAssessmentQuestions,
  listActiveJobsForLearningPath,
  listActiveJobsForRecommendations,
  listApplications,
  listSavedJobs,
  removeCandidateSkill,
  submitCandidateSkillAssessment,
  updateCandidateSkill,
  updateCandidateProfile,
} from './candidates.repository';
import type {
  CandidateActor,
  CandidateProfileInput,
  CandidateSkillInput,
  CandidateSkillUpdateInput,
  SkillAssessmentSubmissionInput,
} from './candidates.types';
import { CandidateError } from './candidates.errors';

export async function getMyProfile(actor: CandidateActor) {
  const profile = await getCandidateProfile(actor.userId);
  assertProfileExists(Boolean(profile), 'Candidate profile not found');
  return profile;
}

export async function updateMyProfile(actor: CandidateActor, input: CandidateProfileInput) {
  const profile = await findCandidateProfile(actor.userId);
  assertProfileExists(Boolean(profile), 'Profile not found');
  await updateCandidateProfile(String(profile!.id), input);
}

export async function addMySkill(actor: CandidateActor, input: CandidateSkillInput) {
  const exists = await addCandidateSkill(actor.userId, input);
  if (exists === undefined) assertProfileExists(false, 'Candidate profile not found');
  if (!exists) throw new CandidateError('This skill is already in your profile.', 409);
}

export async function getMySkills(actor: CandidateActor) {
  const skills = await listCandidateSkills(actor.userId);
  assertProfileExists(Boolean(skills), 'Candidate profile not found');
  return skills!;
}

export async function updateMySkill(actor: CandidateActor, skillId: string, input: CandidateSkillUpdateInput) {
  const updated = await updateCandidateSkill(actor.userId, skillId, input);
  if (updated === undefined) assertProfileExists(false, 'Candidate profile not found');
  if (!updated) throw new CandidateError('Candidate skill not found.', 404);
}

export async function removeMySkill(actor: CandidateActor, skillId: string) {
  const removed = await removeCandidateSkill(actor.userId, skillId);
  assertProfileExists(removed !== undefined, 'Profile not found');
  assertSkillWasRemoved(removed!);
}

export async function getMySkillAssessments(actor: CandidateActor) {
  const assessments = await listCandidateSkillAssessments(actor.userId);
  assertProfileExists(Boolean(assessments), 'Candidate profile not found');
  return assessments!;
}

export async function getMySkillAssessmentQuestions(actor: CandidateActor, skillId: string) {
  const questions = await listCandidateSkillAssessmentQuestions(actor.userId, skillId);
  if (questions.length === 0) {
    throw new CandidateError('No platform assessment is available for this skill yet.', 404);
  }
  return questions;
}

export async function submitMySkillAssessment(
  actor: CandidateActor,
  skillId: string,
  input: SkillAssessmentSubmissionInput,
) {
  const result = await submitCandidateSkillAssessment(actor.userId, skillId, input);
  if (!result) throw new CandidateError('Candidate skill not found.', 404);
  if ('unavailable' in result) throw new CandidateError('No platform assessment is available for this skill yet.', 404);
  if ('invalidAnswers' in result) throw new CandidateError('Assessment answers must include one valid answer for each question.', 400);
  return result;
}

export async function getMyApplications(actor: CandidateActor) {
  const result = await listApplications(actor.userId);
  assertProfileExists(Boolean(result), 'Profile not found');
  return result!;
}

export async function getMySavedJobs(actor: CandidateActor) {
  const result = await listSavedJobs(actor.userId);
  assertProfileExists(Boolean(result), 'Profile not found');
  return result!;
}

export async function getMyRecommendations(actor: CandidateActor) {
  const profile = await findCandidateProfile(actor.userId);
  assertProfileExists(Boolean(profile), 'Profile not found');
  const activeJobs = await listActiveJobsForRecommendations();
  const results = await Promise.all(activeJobs.map(async (job) => {
    try {
      const match = await calculateJobMatch(String(job.id), String(profile!.id));
      return {
        ...job,
        compatibilityScore: match.overallMatchScore,
        scoringBreakdown: match.scoringBreakdown,
        experienceAlignment: match.experienceAlignment,
        matchedSkillsCount: match.matchedSkills.length,
        missingSkillsCount: match.missingSkills.length,
        recommendationReason: match.recommendationReason,
        disclaimer: match.disclaimer,
        matchedSkills: match.matchedSkills,
        missingSkills: match.missingSkills,
      };
    } catch {
      return null;
    }
  }));
  return results.filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => right.compatibilityScore - left.compatibilityScore);
}

export async function getMyLearningPath(actor: CandidateActor) {
  const profile = await findCandidateProfile(actor.userId);
  assertProfileExists(Boolean(profile), 'Profile not found');
  const jobs = await listActiveJobsForLearningPath();
  const frequencies = new Map<string, { count: number; mandatoryCount: number; category: string; skill: string }>();

  for (const job of jobs) {
    try {
      const match = await calculateJobMatch(String(job.id), String(profile!.id));
      for (const missing of match.missingSkills) {
        const key = missing.skill.toLowerCase();
        const current = frequencies.get(key) ?? {
          count: 0,
          mandatoryCount: 0,
          category: missing.category || 'General',
          skill: missing.skill,
        };
        current.count += 1;
        if (missing.isMandatory) current.mandatoryCount += 1;
        frequencies.set(key, current);
      }
    } catch {
      continue;
    }
  }

  const priorityGaps = Array.from(frequencies.values())
    .sort((left, right) => (right.mandatoryCount * 2 + right.count) - (left.mandatoryCount * 2 + left.count))
    .slice(0, 5);
  const roadmapMilestones = priorityGaps.map((gap, index) => ({
    step: index + 1,
    skillName: gap.skill,
    category: gap.category,
    frequencyInOpenJobs: gap.count,
    isMandatoryInRoles: gap.mandatoryCount > 0,
    estimatedHours: gap.mandatoryCount > 0 ? 35 : 20,
    objective: `Master ${gap.skill} core concepts, syntax, and real-world deployment patterns.`,
    recommendedProject: `Build a production-grade component demonstrating ${gap.skill} with tests and schema validation.`,
  }));

  return {
    targetRole: profile!.desiredRole || profile!.headline || 'Software Engineer',
    totalOpenRolesAnalyzed: jobs.length,
    priorityGaps,
    roadmapMilestones,
  };
}
