import { CandidateError } from './candidates.errors';
import type { SkillLevel } from '@/shared/types';

export function assertProfileExists(exists: boolean, message: string): void {
  if (!exists) throw new CandidateError(message, 404);
}

export function assertSkillWasRemoved(removed: boolean): void {
  if (!removed) throw new CandidateError('Candidate skill not found.', 404);
}

export function scoreSkillAssessment(correctAnswers: number, questionCount: number): {
  scorePercentage: number;
  levelAchieved: SkillLevel;
  verified: boolean;
} {
  if (!Number.isInteger(correctAnswers) || !Number.isInteger(questionCount) || questionCount < 1 || correctAnswers < 0 || correctAnswers > questionCount) {
    throw new Error('Assessment score inputs are invalid.');
  }
  const scorePercentage = Math.round((correctAnswers / questionCount) * 100);
  const levelAchieved: SkillLevel = scorePercentage >= 85 ? 'EXPERT'
    : scorePercentage >= 70 ? 'ADVANCED'
      : scorePercentage >= 50 ? 'INTERMEDIATE' : 'BEGINNER';
  return { scorePercentage, levelAchieved, verified: scorePercentage >= 80 };
}
