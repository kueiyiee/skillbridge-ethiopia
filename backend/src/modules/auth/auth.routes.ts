import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticateToken, optionalAuth } from '../../middleware/auth';
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
} from './auth.controller';
import {
  forgotPasswordController,
  resendPasswordResetController,
  resetPasswordController,
} from './password-reset.controller';

const router = Router();
const passwordChangeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many password change attempts. Please try again later.' },
});
const emailVerificationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification code requests. Please try again later.' }
});
const emailCodeAttemptLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification attempts. Please try again later.' }
});

router.post('/register', registerController);
router.post('/login', loginController);
router.post('/forgot-password', forgotPasswordController);
router.post('/resend-reset-otp', resendPasswordResetController);
router.post('/reset-password', resetPasswordController);
router.get('/email-verification', emailVerificationStatusController);
router.post('/email-verification/request', emailVerificationLimit, requestEmailVerificationController);
router.post('/email-verification/resend', emailVerificationLimit, resendEmailVerificationController);
router.post('/email-verification/verify', emailCodeAttemptLimit, verifyEmailController);
router.get('/me', optionalAuth, currentAccountController);
router.patch('/me', authenticateToken, updateAccountController);
router.post('/change-password', passwordChangeLimit, authenticateToken, changePasswordController);
router.delete('/me', authenticateToken, deleteAccountController);
router.post('/logout', logoutController);

export default router;
