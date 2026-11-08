import assert from 'node:assert/strict';
import test from 'node:test';
import { MessagingError } from './messaging.errors';
import { assertApplicationParticipant, assertInvitationCanBeAnswered } from './messaging.policy';
import {
  candidateReplySchema,
  employerMessageSchema,
  employerBulkMessageSchema,
  invitationResponseSchema,
} from './messaging.schemas';

const thread = {
  candidateUserId: 'candidate-1',
  employerUserId: 'employer-1',
  employerVerified: true,
};

test('application conversations are limited to their candidate and verified employer', () => {
  assert.doesNotThrow(() => assertApplicationParticipant(thread, 'candidate-1', 'JOB_SEEKER'));
  assert.doesNotThrow(() => assertApplicationParticipant(thread, 'employer-1', 'EMPLOYER'));
  assert.throws(
    () => assertApplicationParticipant(thread, 'other-user', 'EMPLOYER'),
    (error) => error instanceof MessagingError && error.statusCode === 403,
  );
  assert.throws(
    () => assertApplicationParticipant({ ...thread, employerVerified: false }, 'employer-1', 'EMPLOYER'),
    (error) => error instanceof MessagingError && error.statusCode === 403,
  );
});

test('candidate replies require non-empty bounded content', () => {
  assert.equal(candidateReplySchema.safeParse({ body: ' Thank you for the update. ' }).success, true);
  assert.equal(candidateReplySchema.safeParse({ body: '   ' }).success, false);
  assert.equal(candidateReplySchema.safeParse({ body: 'x'.repeat(5001) }).success, false);
});

test('employer message types validate invitation timing and content', () => {
  assert.equal(employerMessageSchema.safeParse({ kind: 'SHORTLISTED', body: 'You have been shortlisted.' }).success, false);
  assert.equal(employerMessageSchema.safeParse({ kind: 'INTERVIEW_INVITATION', body: 'Please join us.' }).success, false);
  assert.equal(employerMessageSchema.safeParse({
    kind: 'INTERVIEW_INVITATION',
    body: 'Please join us.',
    dueAt: '2020-01-01T10:00:00.000Z',
  }).success, false);
  assert.equal(employerMessageSchema.safeParse({
    kind: 'INTERVIEW_INVITATION',
    body: 'Please join us.',
    dueAt: '2099-01-01T10:00:00.000Z',
  }).success, true);
  assert.equal(employerMessageSchema.safeParse({ kind: 'APPLICATION_UPDATE', body: 'Unsupported direct update.' }).success, false);
});

test('bulk message recipients are unique, capped, and request IDs are required', () => {
  const requestId = '7b0dfe3c-274e-4d5f-b315-8041b47ce103';
  const validMessage = { requestId, applicationIds: ['app-1', 'app-2'], kind: 'MESSAGE', body: 'A relevant application update.' };
  assert.equal(employerBulkMessageSchema.safeParse(validMessage).success, true);
  assert.equal(employerBulkMessageSchema.safeParse({ ...validMessage, applicationIds: ['app-1', 'app-1'] }).success, false);
  assert.equal(employerBulkMessageSchema.safeParse({ ...validMessage, requestId: 'not-a-uuid' }).success, false);
  assert.equal(employerBulkMessageSchema.safeParse({ ...validMessage, applicationIds: Array.from({ length: 101 }, (_, index) => `app-${index}`) }).success, false);
});

test('only the intended candidate can respond once to a pending interview invitation', () => {
  const invitation = {
    recipientUserId: 'candidate-1',
    kind: 'INTERVIEW_INVITATION',
    actionStatus: 'PENDING',
  };
  assert.doesNotThrow(() => assertInvitationCanBeAnswered(invitation, 'candidate-1'));
  assert.throws(
    () => assertInvitationCanBeAnswered(invitation, 'other-user'),
    (error) => error instanceof MessagingError && error.statusCode === 404,
  );
  assert.throws(
    () => assertInvitationCanBeAnswered({ ...invitation, actionStatus: 'ACCEPTED' }, 'candidate-1'),
    (error) => error instanceof MessagingError && error.statusCode === 409,
  );
  assert.equal(invitationResponseSchema.safeParse({ response: 'ACCEPTED' }).success, true);
  assert.equal(invitationResponseSchema.safeParse({ response: 'PENDING' }).success, false);
});
