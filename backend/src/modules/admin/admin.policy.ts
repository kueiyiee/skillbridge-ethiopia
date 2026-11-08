import { AdminError } from './admin.errors';

export function assertCanModerateUser(actorId: string, targetId: string, isActive: boolean): void {
  if (!isActive && actorId === targetId) {
    throw new AdminError('Administrators cannot suspend their own account.', 400);
  }
}

export function isLastActiveAdministrator(role: string, isActive: boolean, activeAdminCount: number): boolean {
  return role === 'ADMIN' && isActive && activeAdminCount <= 1;
}

export type AdminEmailVerificationStatus = 'verified' | 'unverified' | 'action_required';

export function getAdminEmailVerificationStatus(
  emailVerified: boolean,
  verificationMethod: string | null,
  emailVerifiedAt: Date | string | null,
  challengeVerifiedAt: Date | string | null,
  isActive = false,
): AdminEmailVerificationStatus {
  const hasVerificationEvidence = Boolean(
    verificationMethod && ['email_otp', 'admin_manual'].includes(verificationMethod)
      || emailVerifiedAt
      || challengeVerifiedAt,
  );
  if (emailVerified && hasVerificationEvidence) return 'verified';
  if (!emailVerified && !hasVerificationEvidence && !isActive) return 'unverified';
  return 'action_required';
}

export function getEmployerApprovalBlock(
  emailVerified: boolean,
  tinNumber: string | null,
  businessLicenseNo: string | null,
  documentsReviewed = true,
): 'email_unverified' | 'requirements_incomplete' | 'documents_incomplete' | null {
  if (!emailVerified) return 'email_unverified';
  if (!tinNumber?.trim() || !businessLicenseNo?.trim()) return 'requirements_incomplete';
  if (!documentsReviewed) return 'documents_incomplete';
  return null;
}

export function assertRecordUpdated(updated: boolean, message: string): void {
  if (!updated) throw new AdminError(message, 404);
}
