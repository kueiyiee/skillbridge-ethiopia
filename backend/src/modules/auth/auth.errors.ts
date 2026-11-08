export class AuthError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 401 | 403 | 404 | 409 | 410 | 429 | 503) {
    super(message);
    this.name = 'AuthError';
  }
}
