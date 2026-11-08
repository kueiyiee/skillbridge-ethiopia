import { createHash, randomUUID } from 'node:crypto';
import { db } from '../../infrastructure/database/drizzle';
import type { EmployerBulkMessageInput, EmployerMessageInput } from './messaging.types';
import { assertApplicationParticipant, type MessagingRole } from './messaging.policy';
import { MessagingError } from './messaging.errors';
import { assertApplicationStatusTransition } from '../employers/employers.policy';
import type { ApplicationStatus } from '../../../../shared/types';

export interface ApplicationThreadRow {
  applicationId: string;
  jobId: string;
  jobTitle: string;
  applicationStatus: string;
  candidateUserId: string;
  candidateName: string;
  employerUserId: string;
  employerName: string;
  employerVerified: boolean;
}

type QueryResult<T> = { rows: T[]; rowCount: number };
type Query = <T = unknown>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;

export interface ApplicationThreadListRow extends ApplicationThreadRow {
  unreadCount: number | string;
  lastMessage: string | null;
  lastMessageKind: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
}

export interface ApplicationMessageRow {
  id: string;
  applicationId: string;
  senderUserId: string;
  recipientUserId: string;
  kind: string;
  subject: string | null;
  body: string;
  dueAt: string | null;
  actionStatus: string;
  readAt: string | null;
  createdAt: string;
  senderName: string;
}

export async function findApplicationThread(applicationId: string): Promise<ApplicationThreadRow | undefined> {
  return findApplicationThreadWith(db.query.bind(db), applicationId);
}

async function findApplicationThreadWith(
  query: Query,
  applicationId: string,
  lock = false,
): Promise<ApplicationThreadRow | undefined> {
  const result = await query<ApplicationThreadRow>(
    `SELECT ja.id AS "applicationId", ja."jobId", ja.status AS "applicationStatus",
            j.title AS "jobTitle", jsp."userId" AS "candidateUserId", candidate."fullName" AS "candidateName",
            employer."userId" AS "employerUserId", ep."companyName" AS "employerName",
            ep."isApproved" AS "employerVerified"
     FROM job_applications ja
     JOIN jobs j ON j.id = ja."jobId" AND j."archivedAt" IS NULL
     JOIN employer_profiles ep ON ep.id = j."employerId" AND ep."archivedAt" IS NULL
     JOIN users employer ON employer.id = ep."userId" AND employer."archivedAt" IS NULL AND employer."isActive" = true
     JOIN job_seeker_profiles jsp ON jsp.id = ja."jobSeekerId"
     JOIN users candidate ON candidate.id = jsp."userId" AND candidate."archivedAt" IS NULL AND candidate."isActive" = true
     WHERE ja.id = $1 AND ja."archivedAt" IS NULL${lock ? ' FOR UPDATE' : ''}`,
    [applicationId],
  );
  return result.rows[0];
}

export async function listApplicationThreads(userId: string, role: MessagingRole) {
  const membership = role === 'JOB_SEEKER' ? 'jsp."userId" = $1' : 'ep."userId" = $1';
  const employerStatus = role === 'EMPLOYER' ? 'AND ep."isApproved" = true' : '';
  const result = await db.query<ApplicationThreadListRow>(
    `SELECT ja.id AS "applicationId", ja."jobId", j.title AS "jobTitle", ja.status AS "applicationStatus",
            jsp."userId" AS "candidateUserId", candidate."fullName" AS "candidateName",
            ep."userId" AS "employerUserId", ep."companyName" AS "employerName",
    ep."isApproved" AS "employerVerified",
            (SELECT COUNT(*) FROM application_messages unread
             WHERE unread."applicationId" = ja.id AND unread."recipientUserId" = $1 AND unread."readAt" IS NULL) AS "unreadCount",
            (SELECT latest.body FROM application_messages latest
             WHERE latest."applicationId" = ja.id ORDER BY latest."createdAt" DESC, latest.id DESC LIMIT 1) AS "lastMessage",
            (SELECT latest.kind FROM application_messages latest
             WHERE latest."applicationId" = ja.id ORDER BY latest."createdAt" DESC, latest.id DESC LIMIT 1) AS "lastMessageKind",
            (SELECT latest."createdAt" FROM application_messages latest
             WHERE latest."applicationId" = ja.id ORDER BY latest."createdAt" DESC, latest.id DESC LIMIT 1) AS "lastMessageAt",
            (SELECT latest."senderUserId" FROM application_messages latest
             WHERE latest."applicationId" = ja.id ORDER BY latest."createdAt" DESC, latest.id DESC LIMIT 1) AS "lastMessageSenderId"
     FROM job_applications ja
     JOIN jobs j ON j.id = ja."jobId" AND j."archivedAt" IS NULL
     JOIN employer_profiles ep ON ep.id = j."employerId" AND ep."archivedAt" IS NULL
     JOIN job_seeker_profiles jsp ON jsp.id = ja."jobSeekerId"
     JOIN users candidate ON candidate.id = jsp."userId" AND candidate."archivedAt" IS NULL AND candidate."isActive" = true
     WHERE ${membership} AND ja."archivedAt" IS NULL ${employerStatus}
       AND EXISTS (SELECT 1 FROM application_messages exists_message WHERE exists_message."applicationId" = ja.id)
     ORDER BY "lastMessageAt" DESC, ja."appliedAt" DESC`,
    [userId],
  );
  return result.rows;
}

export async function listApplicationMessages(applicationId: string): Promise<ApplicationMessageRow[]> {
  const result = await db.query<ApplicationMessageRow>(
    `SELECT m.id, m."applicationId", m."senderUserId", m."recipientUserId", m.kind,
            m.subject, m.body, m."dueAt", m."actionStatus", m."readAt", m."createdAt",
            u."fullName" AS "senderName"
     FROM application_messages m JOIN users u ON u.id = m."senderUserId"
     WHERE m."applicationId" = $1 ORDER BY m."createdAt" ASC, m.id ASC`,
    [applicationId],
  );
  return result.rows;
}

export async function markIncomingMessagesRead(applicationId: string, userId: string): Promise<void> {
  await db.query(
    `UPDATE application_messages SET "readAt" = CURRENT_TIMESTAMP
     WHERE "applicationId" = $1 AND "recipientUserId" = $2 AND "readAt" IS NULL`,
    [applicationId, userId],
  );
}

export async function sendApplicationMessage(input: EmployerMessageInput & {
  applicationId: string;
  userId: string;
  role: MessagingRole;
}): Promise<void> {
  await db.transaction(async ({ query }) => {
    const thread = await findApplicationThreadWith(query, input.applicationId, true);
    if (!thread) throw new MessagingError('Application conversation not found.', 404);
    assertApplicationParticipant(thread, input.userId, input.role);
    const recipientUserId = input.role === 'JOB_SEEKER' ? thread.employerUserId : thread.candidateUserId;
    if (input.role === 'EMPLOYER') {
      const targetStatus = input.kind === 'INTERVIEW_INVITATION'
        ? 'INTERVIEW_SCHEDULED'
        : input.kind === 'ASSESSMENT_REQUEST'
          ? 'TECHNICAL_ASSESSMENT'
          : null;
      if (targetStatus && thread.applicationStatus !== targetStatus) {
        assertApplicationStatusTransition(thread.applicationStatus as ApplicationStatus, targetStatus);
        await query(
          'UPDATE job_applications SET status = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
          [targetStatus, input.applicationId],
        );
        await query(
          `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
           VALUES ($1, $2, 'APPLICATION_STAGE_UPDATED', 'JobApplication', $3, $4)`,
          [`audit-${randomUUID()}`, input.userId, input.applicationId, `Status set to ${targetStatus} with a ${input.kind.toLowerCase()} sent to the applicant.`],
        );
      }
    }
    await query(
      `INSERT INTO application_messages
       (id, "applicationId", "senderUserId", "recipientUserId", kind, subject, body, "dueAt", "actionStatus", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
      [
        `msg-${randomUUID()}`, input.applicationId, input.userId, recipientUserId, input.kind,
        input.subject || null, input.body, input.dueAt || null,
        input.kind === 'INTERVIEW_INVITATION' ? 'PENDING' : 'NONE',
      ],
    );
  });
}

export async function sendBulkApplicationMessages(
  input: EmployerBulkMessageInput & { userId: string },
): Promise<{ duplicate: boolean; recipientCount: number }> {
  const applicationIds = [...input.applicationIds].sort();
  const payloadHash = createHash('sha256').update(JSON.stringify({
    applicationIds,
    kind: input.kind,
    subject: input.subject?.trim() || null,
    body: input.body.trim(),
    dueAt: input.dueAt || null,
  })).digest('hex');

  return db.transaction(async ({ query }) => {
    const threads: ApplicationThreadRow[] = [];
    for (const applicationId of applicationIds) {
      const thread = await findApplicationThreadWith(query, applicationId, true);
      if (!thread || thread.employerUserId !== input.userId) {
        throw new MessagingError('One or more selected applications are unavailable to this organization.', 404);
      }
      assertApplicationParticipant(thread, input.userId, 'EMPLOYER');
      if (['REJECTED', 'WITHDRAWN', 'HIRED'].includes(thread.applicationStatus)) {
        throw new MessagingError('Messages can only be sent to active application recipients.', 409);
      }
      const targetStatus = input.kind === 'INTERVIEW_INVITATION'
        ? 'INTERVIEW_SCHEDULED'
        : input.kind === 'ASSESSMENT_REQUEST'
          ? 'TECHNICAL_ASSESSMENT'
          : null;
      if (targetStatus && thread.applicationStatus !== targetStatus) {
        assertApplicationStatusTransition(thread.applicationStatus as ApplicationStatus, targetStatus);
      }
      threads.push(thread);
    }

    await query(
      `INSERT INTO employer_message_batches (id, "senderUserId", "payloadHash", "createdAt")
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE id = id`,
      [input.requestId, input.userId, payloadHash],
    );
    const batchResult = await query<{
      senderUserId: string;
      payloadHash: string;
      recipientCount: number;
      completedAt: string | null;
    }>(
      `SELECT "senderUserId", "payloadHash", "recipientCount", "completedAt"
       FROM employer_message_batches WHERE id = $1 FOR UPDATE`,
      [input.requestId],
    );
    const batch = batchResult.rows[0];
    if (!batch || batch.senderUserId !== input.userId || batch.payloadHash !== payloadHash) {
      throw new MessagingError('This send request ID has already been used for a different message.', 409);
    }
    if (batch.completedAt) {
      return { duplicate: true, recipientCount: Number(batch.recipientCount) };
    }

    for (const thread of threads) {
      const targetStatus = input.kind === 'INTERVIEW_INVITATION'
        ? 'INTERVIEW_SCHEDULED'
        : input.kind === 'ASSESSMENT_REQUEST'
          ? 'TECHNICAL_ASSESSMENT'
          : null;
      if (targetStatus && thread.applicationStatus !== targetStatus) {
        await query(
          'UPDATE job_applications SET status = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2',
          [targetStatus, thread.applicationId],
        );
      }
      await query(
        `INSERT INTO application_messages
         (id, "applicationId", "senderUserId", "recipientUserId", "deliveryBatchId",
          kind, subject, body, "dueAt", "actionStatus", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)`,
        [
          `msg-${randomUUID()}`,
          thread.applicationId,
          input.userId,
          thread.candidateUserId,
          input.requestId,
          input.kind,
          input.subject?.trim() || null,
          input.body.trim(),
          input.dueAt || null,
          input.kind === 'INTERVIEW_INVITATION' ? 'PENDING' : 'NONE',
        ],
      );
    }
    await query(
      'UPDATE employer_message_batches SET "recipientCount" = $1, "completedAt" = CURRENT_TIMESTAMP WHERE id = $2',
      [threads.length, input.requestId],
    );
    await query(
      `INSERT INTO platform_audit_logs (id, "userId", action, "entityType", "entityId", details)
       VALUES ($1, $2, 'CANDIDATE_BULK_MESSAGE_SENT', 'EmployerMessageBatch', $3, $4)`,
      [`audit-${randomUUID()}`, input.userId, input.requestId, `${input.kind} delivered individually to ${threads.length} application recipient(s).${input.kind === 'INTERVIEW_INVITATION' ? ' Application stages moved to INTERVIEW_SCHEDULED.' : input.kind === 'ASSESSMENT_REQUEST' ? ' Application stages moved to TECHNICAL_ASSESSMENT.' : ''}`],
    );
    return { duplicate: false, recipientCount: threads.length };
  });
}

export async function respondToInterviewInvitation(input: {
  applicationId: string;
  invitationId: string;
  candidateUserId: string;
  employerUserId: string;
  response: 'ACCEPTED' | 'DECLINED';
}): Promise<boolean> {
  return db.transaction(async ({ query }) => {
    const thread = await findApplicationThreadWith(query, input.applicationId, true);
    if (
      !thread
      || thread.candidateUserId !== input.candidateUserId
      || thread.employerUserId !== input.employerUserId
    ) return false;
    const updated = await query(
      `UPDATE application_messages SET "actionStatus" = $1, "readAt" = COALESCE("readAt", CURRENT_TIMESTAMP)
       WHERE id = $2 AND "applicationId" = $3 AND "recipientUserId" = $4
         AND kind = 'INTERVIEW_INVITATION' AND "actionStatus" = 'PENDING'`,
      [input.response, input.invitationId, input.applicationId, input.candidateUserId],
    );
    if (updated.rowCount !== 1) return false;
    await query(
      `INSERT INTO application_messages
       (id, "applicationId", "senderUserId", "recipientUserId", kind, subject, body, "actionStatus", "createdAt")
       VALUES ($1, $2, $3, $4, 'MESSAGE', $5, $6, 'NONE', CURRENT_TIMESTAMP)`,
      [
        `msg-${randomUUID()}`,
        input.applicationId,
        input.candidateUserId,
        input.employerUserId,
        'Interview invitation response',
        `I ${input.response === 'ACCEPTED' ? 'accept' : 'decline'} the interview invitation.`,
      ],
    );
    return true;
  });
}

export async function findInterviewInvitation(applicationId: string, messageId: string) {
  const result = await db.query<{
    id: string;
    recipientUserId: string;
    kind: string;
    actionStatus: string;
  }>(
    `SELECT id, "recipientUserId", kind, "actionStatus"
     FROM application_messages WHERE id = $1 AND "applicationId" = $2`,
    [messageId, applicationId],
  );
  return result.rows[0];
}
