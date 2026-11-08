import { AuthError } from './auth.errors';

export function assertEmailAvailable(isAvailable: boolean): void {
  if (!isAvailable) throw new AuthError('An account with this email address already exists.', 409);
}

export function assertCredentialsValid(isValid: boolean): void {
  if (!isValid) throw new AuthError('Invalid email or password.', 401);
}

export function assertAccountActive(isActive: boolean): void {
  if (!isActive) {
    throw new AuthError('This account has been suspended. Please contact platform administrators.', 403);
  }
}

export function assertAccountExists(exists: boolean): void {
  if (!exists) throw new AuthError('User account not found', 404);
}

export function assertDeletionPasswordMatches(matches: boolean): void {
  if (!matches) throw new AuthError('Incorrect password. Account deletion halted.', 401);
}

export function assertCanDeleteAdminAccount(role: string, activeAdminCount: number): void {
  if (role === 'ADMIN' && activeAdminCount <= 1) {
    throw new AuthError('The last active administrator account cannot be deleted.', 409);
  }
}
