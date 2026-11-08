import assert from 'node:assert/strict';
import test from 'node:test';
import { scoreSkillAssessment } from './candidates.policy';

test('assessment results map scores to proficiency and only verify at 80 percent', () => {
  assert.deepEqual(scoreSkillAssessment(4, 5), {
    scorePercentage: 80,
    levelAchieved: 'ADVANCED',
    verified: true,
  });
  assert.deepEqual(scoreSkillAssessment(3, 5), {
    scorePercentage: 60,
    levelAchieved: 'INTERMEDIATE',
    verified: false,
  });
  assert.equal(scoreSkillAssessment(5, 5).levelAchieved, 'EXPERT');
  assert.equal(scoreSkillAssessment(1, 5).levelAchieved, 'BEGINNER');
});

test('assessment scoring rejects invalid counts', () => {
  assert.throws(() => scoreSkillAssessment(0, 0), /inputs are invalid/);
  assert.throws(() => scoreSkillAssessment(6, 5), /inputs are invalid/);
});
