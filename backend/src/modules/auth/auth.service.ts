import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { generateToken } from './auth.tokens';
import {
  assertAccountExists,
  assertCanDeleteAdminAccount,
  assertDeletionPasswordMatches,
} from './auth.policy';
import {
  findActiveAuthenticatedUser,
  createAccount,
  findRegistrationAccount,
  deleteAccount as removeAccount,
  findUserForLogin,
  getInstitutionOrCompany,
  getPasswordHash,
  getProfile,
  isAuthTokenRevoked,
  replacePasswordAndRevokeSession,
  revokeAuthToken,
  updateAccount as persistAccountUpdate,
} from './auth.repository';
import type { ExistingRegistration } from './auth.repository';
import type { AccountUpdateInput, AuthActor, AuthDatabaseUser, ChangePasswordInput, LoginInput, RegisterInput } from './auth.types';
import { AuthError } from './auth.errors';
import {
  createEmailVerificationChallenge,
  createEmailVerificationDecoy,
  getEmailVerificationStatus,
  resendEmailVerificationCode,
  verifyEmailVerificationCode,
} from './email-verification.service';

const dummyPasswordHash = bcrypt.hash(randomUUID(), 12);

async function verifyUserPassword(user: AuthDatabaseUser | undefined, password: string): Promise<boolean> {
  const [passwordMatches] = await Promise.all([
    bcrypt.compare(password, user?.passwordHash ?? await dummyPasswordHash),
    bcrypt.compare(password, await dummyPasswordHash)
  ]);
  return Boolean(user && passwordMatches);
}

export async function resolveAuthenticatedUser(userId: string, authVersion = 0): Promise<AuthActor | undefined> {
  const user = await findActiveAuthenticatedUser(userId);
  if (!user || Number(user.authVersion) !== authVersion) return undefined;
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    emailVerified: user.emailVerified,
    authVersion: Number(user.authVersion),
  };
}

export async function isSessionRevoked(sessionId: string): Promise<boolean> {
  return isAuthTokenRevoked(sessionId);
}

export async function revokeSession(sessionId: string, expiresAt: number): Promise<void> {
  return revokeAuthToken(sessionId, expiresAt);
}

export async function verifyLoginCredentials(user: AuthDatabaseUser | undefined, password: string): Promise<boolean> {
  return Boolean(user?.isActive && user.emailVerified && await verifyUserPassword(user, password));
}

export async function register(input: RegisterInput) {
  const email = input.email.toLowerCase();
  let account = await findRegistrationAccount(email);
  const eligiblePendingAccount = (candidate: ExistingRegistration | undefined): candidate is ExistingRegistration => Boolean(
    candidate && !candidate.isActive && !candidate.emailVerified && candidate.archivedAt === null && candidate.role === input.role
  );
  if (account && !eligiblePendingAccount(account)) {
    const challenge = await createEmailVerificationDecoy(email);
    return { ...challenge, email, deliverable: false, requiresCommit: false, userId: '' };
  }

  if (!account) {
    const userId = `usr-${randomUUID()}`;
    const passwordHash = await bcrypt.hash(input.password, 12);
    const created = await createAccount(userId, email, passwordHash, input);
    if (!created) {
      account = await findRegistrationAccount(email);
      if (!eligiblePendingAccount(account)) {
        const challenge = await createEmailVerificationDecoy(email);
        return { ...challenge, email, deliverable: false, requiresCommit: false, userId: '' };
      }
    } else {
      account = { id: userId, email, fullName: input.fullName, role: input.role, isActive: false, emailVerified: false, archivedAt: null };
    }
  }

  if (!eligiblePendingAccount(account)) {
    const challenge = await createEmailVerificationDecoy(email);
    return { ...challenge, email, deliverable: false, requiresCommit: false, userId: '' };
  }
  const challenge = await createEmailVerificationChallenge(account.id);
  return { ...challenge, email, deliverable: true, userId: account.id };
}

export async function requestRegistrationEmailVerification(emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const account = await findRegistrationAccount(email);
  const isPendingRegistration = Boolean(
    account && !account.isActive && !account.emailVerified && account.archivedAt === null
  );
  const challenge = isPendingRegistration
    ? await createEmailVerificationChallenge(account!.id)
    : await createEmailVerificationDecoy(email);
  const requiresCommit = 'requiresCommit' in challenge && challenge.requiresCommit;

  return {
    ...challenge,
    email,
    deliverable: isPendingRegistration,
    requiresCommit,
    userId: isPendingRegistration ? account!.id : '',
  };
}

export async function login(input: LoginInput) {
  const identifier = input.email.trim().toLowerCase();
  const user = await findUserForLogin(identifier);
  const passwordMatches = await verifyUserPassword(user, input.password);
  if (!user || !passwordMatches) {
    throw new AuthError('Invalid email/username or password.', 401);
  }
  if (!user.emailVerified) {
    throw new AuthError('Verify your email address before signing in. Request a code to continue.', 403);
  }
  if (!user.isActive) throw new AuthError('This account has been suspended. Please contact platform administrators.', 403);

  const institutionOrCompany = await getInstitutionOrCompany(user.id, user.role);
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    authVersion: user.authVersion ?? 0
  });
  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      emailVerified: user.emailVerified,
      institutionOrCompany,
    },
  };
}

export async function resendRegistrationCode(token: string | undefined) {
  return resendEmailVerificationCode(token);
}

export async function readEmailVerificationStatus(token: string | undefined) {
  return getEmailVerificationStatus(token);
}

export async function verifyRegistrationCode(token: string | undefined, code: string) {
  return verifyEmailVerificationCode(token, code);
}

export async function getCurrentAccount(actor: AuthActor) {
  return {
    user: {
      id: actor.userId,
      email: actor.email,
      role: actor.role,
      fullName: actor.fullName,
      emailVerified: actor.emailVerified === true,
    },
    profile: await getProfile(actor),
  };
}

export async function updateAccount(actor: AuthActor, input: AccountUpdateInput) {
  await persistAccountUpdate(actor.userId, input);
  return { message: 'Account details updated successfully' };
}

export async function changePassword(actor: AuthActor, input: ChangePasswordInput, session: AuthActor) {
  if (!session.sessionId || !session.sessionExpiresAt || session.userId !== actor.userId) {
    throw new AuthError('Authentication required. Please sign in again.', 401);
  }

  const currentHash = await getPasswordHash(actor.userId);
  assertAccountExists(Boolean(currentHash));
  if (!(await bcrypt.compare(input.currentPassword, currentHash!))) {
    throw new AuthError('Current password is incorrect.', 401);
  }
  if (await bcrypt.compare(input.newPassword, currentHash!)) {
    throw new AuthError('Choose a new password that differs from your current password.', 400);
  }

  const newHash = await bcrypt.hash(input.newPassword, 12);
  const updated = await replacePasswordAndRevokeSession(
    actor.userId,
    currentHash!,
    newHash,
    session.sessionId,
    session.sessionExpiresAt,
  );
  if (updated === null) throw new AuthError('Your password changed in another request. Sign in again and retry.', 409);

  return {
    token: generateToken({ ...actor, authVersion: updated }),
    message: 'Password updated successfully. Your session has been refreshed.',
  };
}

export async function deleteAccount(actor: AuthActor, password: string) {
  const passwordHash = await getPasswordHash(actor.userId);
  assertAccountExists(Boolean(passwordHash));
  assertDeletionPasswordMatches(await bcrypt.compare(password, passwordHash!));
  if (actor.role === 'ADMIN') {
    const result = await removeAccount(actor);
    if (!result) assertCanDeleteAdminAccount(actor.role, 1);
  } else {
    await removeAccount(actor);
  }
  return { message: 'Your account and all associated profile data have been permanently removed.' };
}
