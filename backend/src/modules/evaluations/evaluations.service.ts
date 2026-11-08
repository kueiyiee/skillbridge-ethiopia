import { randomUUID } from 'node:crypto';
import {
  assertCandidateProfileExists,
  assertEmployerIsVerified,
  assertEmployerProfileExists,
  assertJobOwnership,
} from './evaluations.policy';
import {
  candidateExists,
  createEvaluation,
  findEmployer,
  jobBelongsToEmployer,
  listEvaluations,
} from './evaluations.repository';
import type { EvaluationActor, EvaluationInput } from './evaluations.types';

export async function getEvaluations(actor: EvaluationActor) {
  if (actor.role === 'EMPLOYER') {
    const employer = await findEmployer(actor.userId);
    assertEmployerProfileExists(Boolean(employer));
    assertEmployerIsVerified(Boolean(employer!.isApproved));
  }
  return listEvaluations(actor);
}

export async function submitEvaluation(actor: EvaluationActor, data: EvaluationInput) {
  const employer = await findEmployer(actor.userId);
  assertEmployerProfileExists(Boolean(employer));
  assertEmployerIsVerified(Boolean(employer!.isApproved));
  assertCandidateProfileExists(await candidateExists(data.jobSeekerId));
  assertJobOwnership(await jobBelongsToEmployer(data.jobId, employer!.id));

  const overallScore = Number(((data.technicalScore + data.deliveryScore + data.communicationScore + data.adaptabilityScore) / 4).toFixed(1));
  const evaluationId = `eval-${randomUUID()}`;
  await createEvaluation(evaluationId, actor, employer!.id, data, overallScore);
  return { id: evaluationId, overallScore };
}
