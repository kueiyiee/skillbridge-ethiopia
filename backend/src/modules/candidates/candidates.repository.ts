import { randomUUID } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import { scoreSkillAssessment } from './candidates.policy';
import type {
  CandidateProfileInput,
  CandidateRow,
  CandidateSkillInput,
  CandidateSkillUpdateInput,
  SkillAssessmentSubmissionInput,
} from './candidates.types';

export async function getCandidateProfile(userId: string): Promise<CandidateRow | undefined> {
  const result = await db.query<CandidateRow>(
    `SELECT p.*, u.email, u."fullName", u.phone, u."avatarUrl"
     FROM job_seeker_profiles p JOIN users u ON p."userId" = u.id WHERE p."userId" = $1`,
    [userId]
  );
  const profile = result.rows[0];
  if (!profile) return undefined;

  const skills = await db.query(
    `SELECT jsk.*, s.name AS "skillName", s.category, s."demandRating"
     FROM job_seeker_skills jsk JOIN skills s ON jsk."skillId" = s.id
     WHERE jsk."jobSeekerId" = $1 ORDER BY jsk."createdAt" DESC`,
    [profile.id]
  );
  return { ...profile, skills: skills.rows };
}

export async function findCandidateProfile(userId: string): Promise<CandidateRow | undefined> {
  const result = await db.query<CandidateRow>(
    'SELECT id, headline, "desiredRole" FROM job_seeker_profiles WHERE "userId" = $1',
    [userId]
  );
  return result.rows[0];
}

export async function updateCandidateProfile(profileId: string, input: CandidateProfileInput): Promise<void> {
  const columns: Record<keyof CandidateProfileInput, string> = {
    headline: 'headline',
    bio: 'bio',
    experienceYears: '"experienceYears"',
    educationLevel: '"educationLevel"',
    institutionName: '"institutionName"',
    city: 'city',
    subCity: '"subCity"',
    desiredRole: '"desiredRole"',
    desiredSalaryETB: '"desiredSalaryETB"',
    availableForWork: '"availableForWork"',
  };
  const assignments: string[] = [];
  const params: unknown[] = [profileId];

  for (const [key, value] of Object.entries(input) as [keyof CandidateProfileInput, CandidateProfileInput[keyof CandidateProfileInput]][]) {
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${columns[key]} = $${params.length}`);
  }
  if (assignments.length === 0) return;
  assignments.push('"updatedAt" = CURRENT_TIMESTAMP');
  await db.query(`UPDATE job_seeker_profiles SET ${assignments.join(', ')} WHERE id = $1`, params);
}

export async function addCandidateSkill(userId: string, input: CandidateSkillInput): Promise<boolean | undefined> {
  return db.transaction(async ({ query }) => {
    const profile = await query<{ id: string }>('SELECT id FROM job_seeker_profiles WHERE "userId" = $1', [userId]);
    if (!profile.rows[0]) return undefined;
    const profileId = profile.rows[0].id;

    await query(
      'INSERT IGNORE INTO skills (id, name, category, "demandRating") VALUES ($1, $2, $3, 3)',
      [`sk-${randomUUID()}`, input.skillName, input.category]
    );
    const skill = await query<{ id: string }>('SELECT id FROM skills WHERE LOWER(name) = LOWER($1)', [input.skillName]);
    if (!skill.rows[0]) throw new Error('Skill catalog record could not be created.');
    const result = await query(
      `INSERT IGNORE INTO job_seeker_skills
       (id, "jobSeekerId", "skillId", "proficiencyLevel", "yearsExperience", "isVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [`cs-${randomUUID()}`, profileId, skill.rows[0].id, input.proficiencyLevel, input.yearsExperience]
    );
    return result.rowCount > 0;
  });
}

export async function listCandidateSkills(userId: string) {
  const profile = await db.query<{ id: string }>('SELECT id FROM job_seeker_profiles WHERE "userId" = $1', [userId]);
  if (!profile.rows[0]) return undefined;
  const result = await db.query(
    `SELECT jsk.id, jsk."skillId", s.name AS "skillName", s.category, jsk."proficiencyLevel",
            jsk."yearsExperience", jsk."isVerified", jsk."verifiedMethod", jsk."verifiedAt",
            jsk."createdAt", jsk."updatedAt",
            (SELECT COUNT(*) FROM skill_assessment_questions q WHERE q."skillId" = jsk."skillId" AND q."isActive" = true) AS "assessmentQuestionCount"
     FROM job_seeker_skills jsk JOIN skills s ON jsk."skillId" = s.id
     WHERE jsk."jobSeekerId" = $1 ORDER BY s.name`,
    [profile.rows[0].id]
  );
  return result.rows.map((row) => ({
    ...row,
    assessmentQuestionCount: Number(row.assessmentQuestionCount ?? 0),
  }));
}

export async function updateCandidateSkill(
  userId: string,
  skillRecordId: string,
  input: CandidateSkillUpdateInput,
): Promise<boolean | undefined> {
  const profile = await db.query<{ id: string }>('SELECT id FROM job_seeker_profiles WHERE "userId" = $1', [userId]);
  if (!profile.rows[0]) return undefined;
  const ownedSkill = await db.query<{ id: string }>(
    'SELECT id FROM job_seeker_skills WHERE id = $1 AND "jobSeekerId" = $2',
    [skillRecordId, profile.rows[0].id]
  );
  if (!ownedSkill.rows[0]) return false;
  const assignments: string[] = [];
  const params: unknown[] = [skillRecordId, profile.rows[0].id];
  if (input.proficiencyLevel !== undefined) {
    params.push(input.proficiencyLevel);
    assignments.push(`"proficiencyLevel" = $${params.length}`);
  }
  if (input.yearsExperience !== undefined) {
    params.push(input.yearsExperience);
    assignments.push(`"yearsExperience" = $${params.length}`);
  }
  assignments.push('"updatedAt" = CURRENT_TIMESTAMP');
  await db.query(
    `UPDATE job_seeker_skills SET ${assignments.join(', ')} WHERE id = $1 AND "jobSeekerId" = $2`,
    params
  );
  return true;
}

export async function removeCandidateSkill(userId: string, skillId: string): Promise<boolean | undefined> {
  const profile = await db.query<{ id: string }>('SELECT id FROM job_seeker_profiles WHERE "userId" = $1', [userId]);
  if (!profile.rows[0]) return undefined;
  const result = await db.query('DELETE FROM job_seeker_skills WHERE id = $1 AND "jobSeekerId" = $2', [skillId, profile.rows[0].id]);
  return result.rowCount > 0;
}

export async function listCandidateSkillAssessments(userId: string) {
  const profile = await db.query<{ id: string }>('SELECT id FROM job_seeker_profiles WHERE "userId" = $1', [userId]);
  if (!profile.rows[0]) return undefined;
  const result = await db.query(
    `SELECT sa.id, sa."skillId", s.name AS "skillName", sa."scorePercentage", sa."levelAchieved",
            sa."questionsCount", sa."completedAt"
     FROM skill_assessments sa JOIN skills s ON s.id = sa."skillId"
     WHERE sa."jobSeekerId" = $1 ORDER BY sa."completedAt" DESC`,
    [profile.rows[0].id]
  );
  return result.rows;
}

export async function listCandidateSkillAssessmentQuestions(userId: string, skillRecordId: string) {
  const result = await db.query(
    `SELECT q.id, q.prompt, q.optionsJson
     FROM job_seeker_skills jsk
     JOIN skill_assessment_questions q ON q."skillId" = jsk."skillId" AND q."isActive" = true
     WHERE jsk.id = $1 AND jsk."jobSeekerId" = (
       SELECT p.id FROM job_seeker_profiles p WHERE p."userId" = $2
     )
     ORDER BY q."questionOrder" LIMIT 10`,
    [skillRecordId, userId]
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    prompt: String(row.prompt),
    options: typeof row.optionsJson === 'string' ? JSON.parse(row.optionsJson) as string[] : row.optionsJson as string[],
  }));
}

export async function submitCandidateSkillAssessment(
  userId: string,
  skillRecordId: string,
  input: SkillAssessmentSubmissionInput,
) {
  return db.transaction(async ({ query }) => {
    const ownedSkill = await query<{ profileId: string; skillId: string; skillName: string }>(
      `SELECT jsk."jobSeekerId" AS profileId, jsk."skillId", s.name AS skillName
       FROM job_seeker_skills jsk JOIN skills s ON s.id = jsk."skillId"
       JOIN job_seeker_profiles p ON p.id = jsk."jobSeekerId"
       WHERE jsk.id = $1 AND p."userId" = $2`,
      [skillRecordId, userId]
    );
    if (!ownedSkill.rows[0]) return undefined;

    const questionResult = await query<{ id: string; correctOption: number; optionsJson: string | string[] }>(
      `SELECT id, "correctOption", optionsJson FROM skill_assessment_questions
       WHERE "skillId" = $1 AND "isActive" = true ORDER BY "questionOrder" LIMIT 10`,
      [ownedSkill.rows[0].skillId]
    );
    const questions = questionResult.rows;
    if (questions.length < 5) return { unavailable: true as const };
    const questionIds = questions.map((question) => String(question.id));
    if (input.answers.length !== questions.length || questionIds.some((id) => !input.answers.some((answer) => answer.questionId === id))) {
      return { invalidAnswers: true as const };
    }
    for (const answer of input.answers) {
      const question = questions.find((item) => String(item.id) === answer.questionId)!;
      const options = typeof question.optionsJson === 'string' ? JSON.parse(question.optionsJson) as unknown : question.optionsJson;
      if (!Array.isArray(options) || answer.selectedOption >= options.length) return { invalidAnswers: true as const };
    }

    const correctCount = input.answers.filter((answer) =>
      questions.find((question) => String(question.id) === answer.questionId)?.correctOption === answer.selectedOption
    ).length;
    const { scorePercentage, levelAchieved, verified } = scoreSkillAssessment(correctCount, questions.length);
    const attemptId = `assessment-${randomUUID()}`;
    await query(
      `INSERT INTO skill_assessments (id, "jobSeekerId", "skillId", "scorePercentage", "levelAchieved", "questionsCount", "completedAt")
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [attemptId, ownedSkill.rows[0].profileId, ownedSkill.rows[0].skillId, scorePercentage, levelAchieved, questions.length]
    );
    for (const answer of input.answers) {
      const question = questions.find((item) => String(item.id) === answer.questionId)!;
      await query(
        `INSERT INTO skill_assessment_responses (id, "assessmentId", "questionId", "selectedOption", "isCorrect")
         VALUES ($1, $2, $3, $4, $5)`,
        [`response-${randomUUID()}`, attemptId, answer.questionId, answer.selectedOption, question.correctOption === answer.selectedOption]
      );
    }

    if (verified) {
      await query(
        `UPDATE job_seeker_skills SET "isVerified" = true, "verifiedMethod" = 'SKILL_ASSESSMENT',
         "verifiedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
         WHERE id = $1 AND "jobSeekerId" = $2`,
        [skillRecordId, ownedSkill.rows[0].profileId]
      );
    }

    return {
      id: attemptId,
      skillId: ownedSkill.rows[0].skillId,
      skillName: ownedSkill.rows[0].skillName,
      scorePercentage,
      levelAchieved,
      questionsCount: questions.length,
      correctCount,
      verified,
      completedAt: new Date().toISOString(),
    };
  });
}

export async function listApplications(userId: string) {
  const profile = await db.query<{ id: string }>('SELECT id FROM job_seeker_profiles WHERE "userId" = $1', [userId]);
  if (!profile.rows[0]) return undefined;
  const result = await db.query(
    `SELECT ja.*, j.title AS "jobTitle", j.city AS "jobCity", j."workplaceType",
            e."companyName" AS "employerName", e."isApproved" AS "employerVerified"
     FROM job_applications ja JOIN jobs j ON ja."jobId" = j.id
     JOIN employer_profiles e ON j."employerId" = e.id
     WHERE ja."jobSeekerId" = $1 AND ja."archivedAt" IS NULL AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL ORDER BY ja."appliedAt" DESC`,
    [profile.rows[0].id]
  );
  return { count: result.rowCount, data: result.rows };
}

export async function listSavedJobs(userId: string) {
  const profile = await db.query<{ id: string }>('SELECT id FROM job_seeker_profiles WHERE "userId" = $1', [userId]);
  if (!profile.rows[0]) return undefined;
  const result = await db.query(
    `SELECT sj.id AS "savedId", sj."savedAt", j.*, e."companyName" AS "employerName"
     FROM saved_jobs sj JOIN jobs j ON sj."jobId" = j.id
     JOIN employer_profiles e ON j."employerId" = e.id
     WHERE sj."jobSeekerId" = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL ORDER BY sj."savedAt" DESC`,
    [profile.rows[0].id]
  );
  return { count: result.rowCount, data: result.rows };
}

export async function listActiveJobsForRecommendations(): Promise<CandidateRow[]> {
  const result = await db.query<CandidateRow>(
    `SELECT j.id, j.title, j.city, j."jobType", j."workplaceType", j."minExperienceYears",
            j."salaryMinETB", j."salaryMaxETB", e."companyName" AS "employerName", e."isApproved" AS "employerVerified"
     FROM jobs j JOIN employer_profiles e ON j."employerId" = e.id
     WHERE j.status = 'ACTIVE' AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL AND e."isApproved" = true ORDER BY j."createdAt" DESC`
  );
  return result.rows;
}

export async function listActiveJobsForLearningPath(): Promise<CandidateRow[]> {
  const result = await db.query<CandidateRow>(
    `SELECT j.id FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"
     WHERE j.status = 'ACTIVE' AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL AND e."isApproved" = true LIMIT 10`
  );
  return result.rows;
}
