import type { JobRequirementRow, JobRow, JobView } from './jobs.types';

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== 'string') return value == null ? [] : [String(value)];

  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (typeof parsed === 'string') return [parsed];
    return [];
  } catch {
    return [value];
  }
}

export function mapJob(row: JobRow, skillRequirements: JobRequirementRow[]): JobView {
  const applicantsCount = Number.parseInt(String(row.applicantsCount ?? '0'), 10);

  return {
    ...row,
    responsibilities: parseStringList(row.responsibilities),
    qualifications: parseStringList(row.qualifications),
    skillRequirements,
    applicantsCount: Number.isFinite(applicantsCount) ? applicantsCount : 0,
  };
}
