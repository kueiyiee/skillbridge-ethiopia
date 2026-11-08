export class CandidateError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 404 | 409) {
    super(message);
    this.name = 'CandidateError';
  }
}
