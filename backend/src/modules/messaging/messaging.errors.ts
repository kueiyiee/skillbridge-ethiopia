export class MessagingError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 403 | 404 | 409) {
    super(message);
    this.name = 'MessagingError';
  }
}
