export class AdminError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 404 | 409 | 429 | 503) {
    super(message);
    this.name = 'AdminError';
  }
}
