import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSkillGapFallback, fallbackNexusResponse, redactCvText } from './ai-nexus.service';
import { db } from '../../infrastructure/database/drizzle';
import { listRecentConversationMessages, saveMessage } from './ai-nexus.repository';

describe('grounded AI fallbacks', () => {
  it('does not invent vacancies when no active approved jobs exist', () => {
    const result = fallbackNexusResponse('JOB_SEEKER', 'show matching jobs', { activeMarketJobs: [] });
    assert.match(result.content, /No active vacancies/);
    assert.doesNotMatch(result.content, /PostgreSQL|Docker|TypeScript/);
  });

  describe('Nexus retry persistence', () => {
    it('excludes the same idempotent user turn from retry history and uses a duplicate-safe insert', async () => {
      const originalQuery = db.query;
      const statements: Array<{ statement: string; params: unknown[] }> = [];
      db.query = async <T = any>(statement: string, params: unknown[] = []) => {
        statements.push({ statement, params });
        return { rows: [] as T[], rowCount: 1 };
      };
      try {
        const retryMetadata = JSON.stringify({ clientTurnId: '60d3c6fd-6b3e-4bf3-8a4a-726b28f04eef' });
        await listRecentConversationMessages('conv-test', 6, retryMetadata);
        await saveMessage('msg-stable-turn', 'conv-test', 'user', 'Retry this', false, JSON.parse(retryMetadata), true);

        assert.match(statements[0].statement, /NOT \(sender = 'user' AND metadata = \$3\)/);
        assert.deepEqual(statements[0].params, ['conv-test', 6, retryMetadata]);
        assert.match(statements[1].statement, /ON DUPLICATE KEY UPDATE id = id/);
        assert.equal(statements[1].params[0], 'msg-stable-turn');
      } finally {
        db.query = originalQuery;
      }
    });
  });

  it('builds learning steps only from actual job gaps and catalog demand', () => {
    const result = buildSkillGapFallback({
      targetJobTitle: 'Backend Developer',
      score: 50,
      skills: [{ skillName: 'SQL' }],
      missingSkills: [{ skill: 'TypeScript', requiredLevel: 'INTERMEDIATE' }],
      catalogSkills: [{ name: 'TypeScript', demandRating: 5 }, { name: 'Docker', demandRating: 3 }],
    });
    assert.deepEqual(result.data.weeklyPlan.map((item) => item.targetSkill), ['TypeScript']);
    assert.match(result.data.marketContextEthiopia, /TypeScript/);
    assert.doesNotMatch(result.data.summary, /Docker/);
  });

  it('does not claim a job-match score without job requirements', () => {
    const result = buildSkillGapFallback({
      targetJobTitle: 'A target role',
      score: null,
      skills: [{ skillName: 'SQL' }],
      missingSkills: [],
      catalogSkills: [
        { name: 'SQL', demandRating: 5 },
        { name: 'TypeScript', demandRating: 4 },
      ],
    });
    assert.match(result.data.summary, /match score was not calculated/);
    assert.deepEqual(result.data.weeklyPlan.map((item) => item.targetSkill), ['TypeScript']);
  });

  it('redacts contact and gender fields before CV text is sent to a provider', () => {
    const redacted = redactCvText('Name: Ada Example\nEmail: ada@example.test\nPhone: +251 911 234 567\nGender: Female\nExperience: Built TypeScript APIs for 4 years.');
    assert.doesNotMatch(redacted, /ada@example\.test|911 234 567|Gender: Female|Ada Example/);
    assert.match(redacted, /TypeScript APIs/);
  });
});