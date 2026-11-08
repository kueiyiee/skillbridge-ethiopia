export class EvaluationError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404) {
    super(message);
    this.name = 'EvaluationError';
  }
}
