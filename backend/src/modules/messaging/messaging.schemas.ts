import { z } from 'zod';

const messageBody = z.string().trim().min(1).max(5000);

export const candidateReplySchema = z.object({
  body: messageBody,
});

const employerMessageFields = z.object({
  kind: z.enum(['MESSAGE', 'INTERVIEW_INVITATION', 'INFORMATION_REQUEST', 'ASSESSMENT_REQUEST']),
  subject: z.string().trim().max(191).optional(),
  body: messageBody,
  dueAt: z.string().datetime().optional(),
});

const validateInterviewDate = (
  message: z.infer<typeof employerMessageFields>,
  context: z.RefinementCtx,
) => {
  if (message.kind === 'INTERVIEW_INVITATION') {
    if (!message.dueAt) {
      context.addIssue({ code: 'custom', path: ['dueAt'], message: 'An interview date and time are required.' });
    } else if (new Date(message.dueAt).getTime() <= Date.now()) {
      context.addIssue({ code: 'custom', path: ['dueAt'], message: 'The interview date and time must be in the future.' });
    }
  }
};

export const employerMessageSchema = employerMessageFields.superRefine(validateInterviewDate);

export const employerBulkMessageSchema = employerMessageFields.extend({
  requestId: z.string().uuid(),
  applicationIds: z.array(z.string().trim().min(1).max(191)).min(1).max(100),
}).superRefine((message, context) => {
  validateInterviewDate(message, context);
  if (new Set(message.applicationIds).size !== message.applicationIds.length) {
    context.addIssue({ code: 'custom', path: ['applicationIds'], message: 'Each recipient application can appear only once.' });
  }
});

export const invitationResponseSchema = z.object({
  response: z.enum(['ACCEPTED', 'DECLINED']),
});
