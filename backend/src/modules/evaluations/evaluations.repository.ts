import { randomUUID } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import type { EvaluationActor, EvaluationInput, EvaluationRow } from './evaluations.types';

export async function listEvaluations(actor: EvaluationActor): Promise<EvaluationRow[]> {
  let sql = `
    SELECT ef.*, e."companyName", j.title AS "jobTitle", u."fullName" AS "candidateName"
    FROM employer_feedbacks ef
    JOIN employer_profiles e ON ef."employerId" = e.id
    JOIN jobs j ON ef."jobId" = j.id
    JOIN job_seeker_profiles p ON ef."jobSeekerId" = p.id
    JOIN users u ON p."userId" = u.id
  `;
  const params: unknown[] = [];
  sql += ' WHERE e."archivedAt" IS NULL AND j."archivedAt" IS NULL';

  if (actor.role === 'EMPLOYER') {
    const employer = await db.query<{ id: string }>('SELECT id FROM employer_profiles WHERE "userId" = $1', [actor.userId]);
    if (!employer.rows[0]) return [];
    params.push(employer.rows[0].id);
    sql += ' AND ef."employerId" = $1';
  } else if (actor.role === 'JOB_SEEKER') {
    const candidate = await db.query<{ id: string }>('SELECT id FROM job_seeker_profiles WHERE "userId" = $1', [actor.userId]);
    if (!candidate.rows[0]) return [];
    params.push(candidate.rows[0].id);
    sql += ' AND ef."jobSeekerId" = $1';
  }

  sql += ' ORDER BY ef."createdAt" DESC';
  const result = await db.query<EvaluationRow>(sql, params);
  return result.rows;
}

export async function findEmployer(userId: string): Promise<{ id: string; companyName: string; isApproved: boolean } | undefined> {
  const result = await db.query<{ id: string; companyName: string; isApproved: boolean }>(
    'SELECT id, "companyName", "isApproved" FROM employer_profiles WHERE "userId" = $1 AND "archivedAt" IS NULL',
    [userId]
  );
  return result.rows[0];
}

export async function candidateExists(candidateId: string): Promise<boolean> {
  const result = await db.query('SELECT id FROM job_seeker_profiles WHERE id = $1', [candidateId]);
  return result.rowCount > 0;
}

export async function jobBelongsToEmployer(jobId: string, employerId: string): Promise<boolean> {
  const result = await db.query('SELECT id FROM jobs WHERE id = $1 AND "employerId" = $2 AND "archivedAt" IS NULL', [jobId, employerId]);
  return result.rowCount > 0;
}

export async function createEvaluation(
  evaluationId: string,
  actor: EvaluationActor,
  employerId: string,
  data: EvaluationInput,
  overallScore: number,
): Promise<void> {
  await db.transaction(async ({ query }) => {
    await query(
      `INSERT INTO employer_feedbacks
       (id, "employerId", "jobSeekerId", "jobId", period, "technicalScore", "deliveryScore",
        "communicationScore", "adaptabilityScore", "overallScore", strengths, "growthAreas",
        "retentionRecommendation", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)`,
      [
        evaluationId,
        employerId,
        data.jobSeekerId,
        data.jobId,
        data.period,
        data.technicalScore,
        data.deliveryScore,
        data.communicationScore,
        data.adaptabilityScore,
        overallScore,
        data.strengths,
        data.growthAreas,
        data.retentionRecommendation,
      ]
    );
    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [`audit-${randomUUID()}`, actor.userId, 'PERFORMANCE_EVALUATION_RECORDED', 'EmployerFeedback', evaluationId, `Score: ${overallScore}/5.0`]
    );
  });
}
