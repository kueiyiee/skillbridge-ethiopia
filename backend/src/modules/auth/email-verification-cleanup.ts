import { cleanExpiredEmailVerificationChallenges } from './email-verification.service';

export function startEmailVerificationCleanup(): () => void {
  const cleanup = async () => {
    try {
      await cleanExpiredEmailVerificationChallenges();
    } catch (error) {
      console.error('[auth] Expired verification cleanup failed:', error instanceof Error ? error.name : 'UnknownError');
    }
  };

  void cleanup();
  const timer = setInterval(() => void cleanup(), 60 * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
