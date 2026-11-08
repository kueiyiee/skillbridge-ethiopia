import { db } from '../infrastructure/database/drizzle';

type MatchingRow = Record<string, any>;

export async function loadJobMatchData(jobId: string, jobSeekerId: string) {
  const jobResult = await db.query<MatchingRow>(
    `SELECT j.title, j."minExperienceYears", j.department, j.city
     FROM jobs j JOIN employer_profiles e ON e.id = j."employerId"
     JOIN users u ON u.id = e."userId"
     WHERE j.id = $1 AND j."archivedAt" IS NULL AND e."archivedAt" IS NULL
       AND u."archivedAt" IS NULL AND u."isActive" = true AND j.status = $2 AND e."isApproved" = true`,
    [jobId, 'ACTIVE']
  );
  if (jobResult.rowCount === 0) return undefined;

  const [requirements, candidateProfile, candidateSkills] = await Promise.all([
    db.query<MatchingRow>(
      `SELECT jsr.*, s.name AS "skillName", s.category
       FROM job_skill_requirements jsr JOIN skills s ON jsr."skillId" = s.id WHERE jsr."jobId" = $1`,
      [jobId]
    ),
    db.query<MatchingRow>('SELECT "experienceYears", headline FROM job_seeker_profiles WHERE id = $1', [jobSeekerId]),
    db.query<MatchingRow>(
      `SELECT jsk.*, s.name AS "skillName" FROM job_seeker_skills jsk
       JOIN skills s ON jsk."skillId" = s.id WHERE jsk."jobSeekerId" = $1`,
      [jobSeekerId]
    ),
  ]);

  return {
    job: jobResult.rows[0],
    requirements: requirements.rows,
    candidateProfile: candidateProfile.rows[0],
    candidateSkills: candidateSkills.rows,
  };
}
