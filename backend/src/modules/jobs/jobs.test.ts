import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLocationMatchValues, getLocationOptions } from '@/shared/ethiopiaLocations';
import { jobCreationSchema, jobSearchSchema } from './jobs.schemas';
import { mapJob } from './jobs.mapper';
import { assertApplicationIsNew, assertEmployerCanPublishJob, assertEmployerIsVerified, assertJobCanBePublished, assertJobOwnedByEmployer } from './jobs.policy';

const validJob = {
  title: 'Backend Engineer',
  summary: 'Build services for the hiring platform.',
  responsibilities: ['Design APIs'],
  qualifications: ['TypeScript'],
  skillRequirements: [{ skillId: 'skill-postgresql' }],
};

describe('jobs schemas', () => {
  it('applies safe defaults to valid job creation input', () => {
    const result = jobCreationSchema.safeParse(validJob);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.jobType, 'FULL_TIME');
      assert.equal(result.data.city, 'Addis Ababa');
      assert.equal(result.data.skillRequirements[0].requiredLevel, 'INTERMEDIATE');
    }
  });

  it('rejects invalid minimum salary and empty skill requirements', () => {
    const result = jobCreationSchema.safeParse({
      ...validJob,
      salaryMinETB: -1,
      skillRequirements: [],
    });
    assert.equal(result.success, false);
    assert.equal(jobCreationSchema.safeParse({
      ...validJob,
      skillRequirements: [{ skillName: 'Not a catalog skill' }],
    }).success, false);
  });

  it('rejects salary ranges where the maximum is below the minimum', () => {
    assert.equal(jobCreationSchema.safeParse({
      ...validJob,
      salaryMinETB: 50000,
      salaryMaxETB: 40000,
    }).success, false);
  });

  it('coerces the salary query parameter to a bounded integer', () => {
    const result = jobSearchSchema.safeParse({ minSalary: '12000' });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.minSalary, 12000);
    assert.equal(jobSearchSchema.safeParse({ minSalary: '-1' }).success, false);
  });

  it('includes all current Ethiopian regions and city aliases for filtering', () => {
    const allRegions = getLocationOptions('');
    assert.equal(allRegions.some((location: { name: string }) => location.name === 'Addis Ababa City Administration'), true);
    assert.equal(allRegions.some((location: { name: string }) => location.name === 'Sidama Region'), true);
    assert.equal(allRegions.some((location: { name: string }) => location.name === 'Tigray Region'), true);
    assert.equal(allRegions.some((location: { name: string }) => location.name === 'Hawassa'), true);
    assert.equal(allRegions.some((location: { name: string }) => location.name === 'Dire Dawa City Administration'), true);
    assert.ok(getLocationMatchValues('Sidama Region').includes('hawassa'));
    assert.ok(getLocationMatchValues('SNNPR').includes('sidama region'));
  });
});

describe('jobs mapping and policy', () => {
  it('normalizes stored JSON lists and applicant counts', () => {
    const job = mapJob({
      responsibilities: '["Design APIs"]',
      qualifications: 'invalid json',
      applicantsCount: '4',
    }, [{ skillName: 'PostgreSQL' }]);

    assert.deepEqual(job.responsibilities, ['Design APIs']);
    assert.deepEqual(job.qualifications, ['invalid json']);
    assert.equal(job.applicantsCount, 4);
    assert.equal(job.skillRequirements.length, 1);
  });

  it('rejects actions on jobs owned by another employer', () => {
    assert.throws(() => assertJobOwnedByEmployer(false), { statusCode: 403 });
    assert.doesNotThrow(() => assertJobOwnedByEmployer(true));
  });

  it('requires organization verification before publishing a vacancy', () => {
    assert.throws(() => assertEmployerCanPublishJob(false), { statusCode: 403 });
    assert.doesNotThrow(() => assertEmployerCanPublishJob(true));
  });

  it('requires organization verification for all recruiting actions', () => {
    assert.throws(() => assertEmployerIsVerified(false), { statusCode: 403 });
    assert.doesNotThrow(() => assertEmployerIsVerified(true));
  });

  it('does not allow expired vacancies to be republished', () => {
    assert.throws(() => assertJobCanBePublished(true), { statusCode: 409 });
    assert.doesNotThrow(() => assertJobCanBePublished(false));
  });

  it('rejects duplicate applications', () => {
    assert.throws(() => assertApplicationIsNew(true), { statusCode: 409 });
    assert.doesNotThrow(() => assertApplicationIsNew(false));
  });
});
