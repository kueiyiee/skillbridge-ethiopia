import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { identifyDatabaseEngine, prepareMysqlQuery } from './drizzle';
import { expectedMigrationNames } from './migrate';

test('prepares MySQL identifiers and repeated numbered parameters', () => {
  const prepared = prepareMysqlQuery(
    'SELECT "fullName" FROM users WHERE id = $1 OR "email" = $1 AND role = $2',
    ['user-1', 'ADMIN'],
  );

  assert.equal(
    prepared.sql,
    'SELECT `fullName` FROM users WHERE id = ? OR `email` = ? AND role = ?',
  );
  assert.deepEqual(prepared.params, ['user-1', 'user-1', 'ADMIN']);
});

test('rejects SQL that references an unavailable parameter', () => {
  assert.throws(
    () => prepareMysqlQuery('SELECT id FROM users WHERE id = $2', ['user-1']),
    /missing parameter \$2/,
  );
});

test('identifies the actual MySQL-compatible database engine', () => {
  assert.equal(identifyDatabaseEngine('10.4.32-MariaDB'), 'MariaDB');
  assert.equal(identifyDatabaseEngine('8.4.0'), 'MySQL');
});

test('recent migrations preserve security and feature ordering', () => {
  assert.equal(expectedMigrationNames.at(-9), '20261022000200_email_otp_verification');
  assert.equal(expectedMigrationNames.at(-8), '20261023000100_shared_login_rate_limits');
  assert.equal(expectedMigrationNames.at(-7), '20261023000200_admin_email_verification');
  assert.equal(expectedMigrationNames.at(-6), '20261023000300_employer_verification_documents');
  assert.equal(expectedMigrationNames.at(-5), '20261023000400_password_reset_security');
  assert.equal(expectedMigrationNames.at(-4), '20261023000500_email_verification_evidence');
  assert.equal(expectedMigrationNames.at(-3), '20261025000100_application_messaging');
  assert.equal(expectedMigrationNames.at(-2), '20261025000200_employer_recruitment_workflow');
  assert.equal(expectedMigrationNames.at(-1), '20261026000100_candidate_skill_assessments');
});

test('candidate skill assessment migration persists questions and attempt responses', async () => {
  const migrationName = '20261026000100_candidate_skill_assessments';
  assert.ok(expectedMigrationNames.includes(migrationName));
  const migrationSql = await readFile(
    new URL(`../../../../prisma/migrations/${migrationName}/migration.sql`, import.meta.url),
    'utf8',
  );
  assert.match(migrationSql, /ALTER TABLE `job_seeker_skills`[\s\S]*ADD COLUMN `updatedAt`/);
  assert.match(migrationSql, /CREATE TABLE `skill_assessment_questions`/);
  assert.match(migrationSql, /CREATE TABLE `skill_assessment_responses`/);
  assert.match(migrationSql, /FOREIGN KEY \(`assessmentId`\) REFERENCES `skill_assessments`/);
  assert.match(migrationSql, /UNIQUE INDEX `skill_assessment_responses_assessmentId_questionId_key`/);
});

test('email verification evidence migration adds a nullable timestamp without rewriting existing accounts', async () => {
  const migrationName = '20261023000500_email_verification_evidence';
  assert.ok(expectedMigrationNames.includes(migrationName));
  const migrationSql = await readFile(
    new URL(`../../../../prisma/migrations/${migrationName}/migration.sql`, import.meta.url),
    'utf8',
  );
  assert.match(migrationSql, /ADD COLUMN `emailVerifiedAt` DATETIME\(3\) NULL/);
  assert.match(migrationSql, /MODIFY COLUMN `emailVerified` BOOLEAN NOT NULL DEFAULT false/);
  assert.doesNotMatch(migrationSql, /UPDATE\s+`users`/i);
});

test('registered password reset migration adds the auth version required by login', async () => {
  const migrationName = '20261023000400_password_reset_security';
  assert.ok(expectedMigrationNames.includes(migrationName));

  const migrationSql = await readFile(
    new URL(`../../../../prisma/migrations/${migrationName}/migration.sql`, import.meta.url),
    'utf8',
  );
  assert.match(migrationSql, /ALTER TABLE `users`\s+ADD COLUMN `authVersion` INT UNSIGNED NOT NULL DEFAULT 0;/);
  assert.match(migrationSql, /CREATE TABLE `password_reset_challenges`/);
});

test('registered application messaging migration stores scoped, readable conversations', async () => {
  const migrationName = '20261025000100_application_messaging';
  assert.equal(expectedMigrationNames.at(-3), migrationName);

  const migrationSql = await readFile(
    new URL(`../../../../prisma/migrations/${migrationName}/migration.sql`, import.meta.url),
    'utf8',
  );
  assert.match(migrationSql, /CREATE TABLE `application_messages`/);
  assert.match(migrationSql, /`applicationId` VARCHAR\(191\) NOT NULL/);
  assert.match(migrationSql, /`recipientUserId` VARCHAR\(191\) NOT NULL/);
  assert.match(migrationSql, /`readAt` DATETIME\(3\) NULL/);
  assert.match(migrationSql, /INTERVIEW_INVITATION/);
  assert.match(migrationSql, /FOREIGN KEY \(`applicationId`\) REFERENCES `job_applications`/);
});

test('registered recruitment workflow migration adds shortlist/hired stages and private, idempotent batch delivery', async () => {
  const migrationName = '20261025000200_employer_recruitment_workflow';
  assert.equal(expectedMigrationNames.at(-2), migrationName);
  const migrationSql = await readFile(
    new URL(`../../../../prisma/migrations/${migrationName}/migration.sql`, import.meta.url),
    'utf8',
  );
  assert.match(migrationSql, /'SHORTLISTED'/);
  assert.match(migrationSql, /'HIRED'/);
  assert.match(migrationSql, /CREATE TABLE `employer_message_batches`/);
  assert.match(migrationSql, /application_messages_deliveryBatchId_applicationId_key/);
  assert.match(migrationSql, /FOREIGN KEY \(`deliveryBatchId`\) REFERENCES `employer_message_batches`/);
});