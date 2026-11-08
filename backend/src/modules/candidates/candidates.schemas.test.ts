import assert from 'node:assert/strict';
import test from 'node:test';
import {
  candidateSkillSchema,
  candidateSkillUpdateSchema,
  skillAssessmentSubmissionSchema,
} from './candidates.schemas';

test('candidate skills validate proficiency and normalize names', () => {
  const parsed = candidateSkillSchema.safeParse({
    skillName: '  TypeScript  ',
    category: 'Languages',
    proficiencyLevel: 'EXPERT',
    yearsExperience: 4,
  });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.skillName, 'TypeScript');
  assert.equal(candidateSkillSchema.safeParse({ skillName: 'SQL', proficiencyLevel: 'MASTER' }).success, false);
});

test('candidate skill update requires valid editable fields', () => {
  assert.equal(candidateSkillUpdateSchema.safeParse({ proficiencyLevel: 'ADVANCED' }).success, true);
  assert.equal(candidateSkillUpdateSchema.safeParse({ yearsExperience: 2.5 }).success, true);
  assert.equal(candidateSkillUpdateSchema.safeParse({}).success, false);
  assert.equal(candidateSkillUpdateSchema.safeParse({ yearsExperience: -1 }).success, false);
});

test('assessment submissions reject duplicate or malformed answers', () => {
  const valid = [
    { questionId: 'q1', selectedOption: 0 },
    { questionId: 'q2', selectedOption: 3 },
  ];
  assert.equal(skillAssessmentSubmissionSchema.safeParse({ answers: valid }).success, true);
  assert.equal(skillAssessmentSubmissionSchema.safeParse({ answers: [valid[0], valid[0]] }).success, false);
  assert.equal(skillAssessmentSubmissionSchema.safeParse({ answers: [{ questionId: 'q1', selectedOption: -1 }] }).success, false);
});
