import { randomUUID } from 'node:crypto';
import { calculateJobMatch } from '../../services/job-matching.service';
import { JobsError } from './jobs.errors';
import { mapJob } from './jobs.mapper';
import {
  assertApplicationIsNew,
  assertCandidateProfileExists,
  assertEmployerCanPublishJob,
  assertEmployerIsVerified,
  assertJobCanBePublished,
  assertJobIsActive,
  assertJobOwnedByEmployer,
} from './jobs.policy';
import { jobsRepository } from './jobs.repository';
import type {
  JobActor,
  JobApplicationInput,
  JobCreationInput,
  JobMatchWeights,
  JobSearchFilters,
  JobStatus,
  JobView,
} from './jobs.types';

export async function listJobs(filters: JobSearchFilters): Promise<JobView[]> {
  const rows = await jobsRepository.list(filters);
  const jobs = await Promise.all(rows.map(async (row) => {
    const requirements = await jobsRepository.getSkillRequirements(String(row.id));
    return mapJob(row, requirements);
  }));

  if (!filters.skill || filters.skill === 'All') return jobs;
  const targetSkill = filters.skill.toLowerCase();
  return jobs.filter((job) => job.skillRequirements.some((requirement) =>
    String(requirement.skillName).toLowerCase() === targetSkill
  ));
}

export async function getJob(jobId: string, actor?: JobActor): Promise<JobView> {
  const row = await jobsRepository.findByIdForViewer(jobId, actor?.userId ?? null, actor?.role ?? null);
  if (!row) throw new JobsError('Job posting not found', 404);

  await jobsRepository.incrementViews(jobId);
  const requirements = await jobsRepository.getSkillRequirements(jobId);
  return mapJob(row, requirements);
}

export async function createJob(actor: JobActor, data: JobCreationInput) {
  const employer = await jobsRepository.findEmployerForUser(actor.userId);
  if (!employer) throw new JobsError('Employer profile not established.', 403);
  assertEmployerIsVerified(Boolean(employer.isApproved));

  const jobId = `job-${randomUUID()}`;
  const status = 'ACTIVE';
  await jobsRepository.create(jobId, actor.userId, String(employer.id), status, data);
  return { id: jobId, title: data.title, employerName: String(employer.companyName), status };
}

export async function updateJob(jobId: string, actor: JobActor, data: JobCreationInput): Promise<void> {
  const employer = await jobsRepository.findEmployerForUser(actor.userId);
  if (!employer) throw new JobsError('Employer profile not established.', 403);
  assertEmployerIsVerified(Boolean(employer.isApproved));
  assertJobOwnedByEmployer(await jobsRepository.isOwnedByEmployer(jobId, actor.userId));
  await jobsRepository.update(jobId, actor.userId, data);
}

export async function updateJobStatus(jobId: string, userId: string, status: JobStatus): Promise<void> {
  const employer = await jobsRepository.findEmployerForUser(userId);
  if (!employer) throw new JobsError('Employer profile not established.', 403);
  assertEmployerIsVerified(Boolean(employer.isApproved));
  const isOwner = await jobsRepository.isOwnedByEmployer(jobId, userId);
  assertJobOwnedByEmployer(isOwner);
  if (status === 'ACTIVE') {
    assertEmployerCanPublishJob(Boolean(employer.isApproved));
    assertJobCanBePublished(await jobsRepository.isExpired(jobId));
  }
  await jobsRepository.updateStatus(jobId, status, userId);
}

export async function applyForJob(jobId: string, userId: string, data: JobApplicationInput) {
  const isActive = await jobsRepository.isActiveAndVerified(jobId);
  assertJobIsActive(isActive);

  const candidate = await jobsRepository.findCandidateProfile(userId);
  assertCandidateProfileExists(Boolean(candidate), 400, 'Job seeker profile not found.');
  const profileId = String(candidate!.id);

  const alreadyApplied = await jobsRepository.hasApplied(jobId, profileId);
  assertApplicationIsNew(alreadyApplied);

  const matchResult = await calculateJobMatch(jobId, profileId);
  const applicationId = `app-${randomUUID()}`;
  const created = await jobsRepository.createApplication(applicationId, jobId, profileId, data.coverNote, matchResult);
  assertApplicationIsNew(!created);

  return { applicationId, matchScore: matchResult.overallMatchScore };
}

export async function saveJob(jobId: string, userId: string): Promise<void> {
  const candidate = await jobsRepository.findCandidateProfile(userId);
  assertCandidateProfileExists(Boolean(candidate), 400, 'Profile not found');
  await jobsRepository.save(jobId, String(candidate!.id));
}

export async function removeSavedJob(jobId: string, userId: string): Promise<void> {
  const candidate = await jobsRepository.findCandidateProfile(userId);
  assertCandidateProfileExists(Boolean(candidate), 400, 'Profile not found');
  await jobsRepository.removeSaved(jobId, String(candidate!.id));
}

export async function analyzeJobGap(jobId: string, userId: string, weights: JobMatchWeights) {
  const candidateId = await jobsRepository.findCandidateId(userId);
  assertCandidateProfileExists(Boolean(candidateId), 404, 'Candidate profile not found.');
  return calculateJobMatch(jobId, candidateId!, weights);
}
