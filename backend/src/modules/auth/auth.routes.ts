import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateToken, optionalAuth } from '../../middleware/auth';
import { MysqlRateLimitStore } from '../../middleware/mysql-rate-limit-store';
import { db } from '../../infrastructure/database/drizzle';
import {
  changePasswordController,
  currentAccountController,
  deleteAccountController,
  emailVerificationStatusController,
  loginController,
  logoutController,
  requestEmailVerificationController,
  resendEmailVerificationController,
  registerController,
  updateAccountController,
  verifyEmailController,
  completeMfaLoginController,
  mfaStatusController,
  beginMfaEnrollmentController,
  confirmMfaEnrollmentController,
  disableMfaController,
} from './auth.controller';
import {
  forgotPasswordController,
  resendPasswordResetController,
  resetPasswordController,
} from './password-reset.controller';

const router = Router();
const rateLimitSecret = process.env.JWT_SECRET ?? '';
const passwordChangeStore = new MysqlRateLimitStore(db.query.bind(db), rateLimitSecret);
passwordChangeStore.prefix = 'mysql-password-change:';
const emailVerificationStore = new MysqlRateLimitStore(db.query.bind(db), rateLimitSecret);
emailVerificationStore.prefix = 'mysql-email-verification:';
const emailCodeAttemptStore = new MysqlRateLimitStore(db.query.bind(db), rateLimitSecret);
emailCodeAttemptStore.prefix = 'mysql-email-verification-attempt:';
const mfaChallengeStore = new MysqlRateLimitStore(db.query.bind(db), rateLimitSecret);
mfaChallengeStore.prefix = 'mysql-mfa-challenge:';

const passwordChangeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: passwordChangeStore,
  message: { success: false, error: 'Too many password change attempts. Please try again later.' },
});
const emailVerificationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: emailVerificationStore,
  message: { success: false, error: 'Too many verification code requests. Please try again later.' }
});
const mfaChallengeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: mfaChallengeStore,
  message: { success: false, error: 'Too many MFA verification attempts. Sign in again later.' },
});
const emailCodeAttemptLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: emailCodeAttemptStore,
  message: { success: false, error: 'Too many verification attempts. Please try again later.' }
});

router.post('/register', registerController);
router.post('/login', loginController);
router.post('/mfa/login/verify', mfaChallengeLimit, completeMfaLoginController);
router.post('/forgot-password', forgotPasswordController);
router.post('/resend-reset-otp', resendPasswordResetController);
router.post('/reset-password', resetPasswordController);
router.get('/email-verification', emailVerificationStatusController);
router.post('/email-verification/request', emailVerificationLimit, requestEmailVerificationController);
router.post('/email-verification/resend', emailVerificationLimit, resendEmailVerificationController);
router.post('/email-verification/verify', emailCodeAttemptLimit, verifyEmailController);
router.get('/mfa', authenticateToken, mfaStatusController);
router.post('/mfa/totp/enroll', passwordChangeLimit, authenticateToken, beginMfaEnrollmentController);
router.post('/mfa/totp/confirm', emailCodeAttemptLimit, authenticateToken, confirmMfaEnrollmentController);
router.post('/mfa/totp/disable', passwordChangeLimit, authenticateToken, disableMfaController);
router.get('/me', optionalAuth, currentAccountController);
router.patch('/me', authenticateToken, updateAccountController);
router.post('/change-password', passwordChangeLimit, authenticateToken, changePasswordController);
router.delete('/me', authenticateToken, deleteAccountController);
router.post('/logout', logoutController);

export default router;
