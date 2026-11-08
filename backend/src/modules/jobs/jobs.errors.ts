export type JobsErrorStatus = 400 | 403 | 404 | 409;

export class JobsError extends Error {
  constructor(
    message: string,
    public readonly statusCode: JobsErrorStatus,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'JobsError';
  }
}
