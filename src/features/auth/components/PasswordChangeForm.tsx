import React, { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { api } from '@/src/services/api-client';

export const PasswordChangeForm: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordBytes = new TextEncoder().encode(newPassword).length;
  const hasMinimumLength = newPassword.length >= 12;
  const fitsPasswordLimit = passwordBytes <= 72;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!hasMinimumLength) {
      setError('Choose a password with at least 12 characters.');
      return;
    }
    if (!fitsPasswordLimit) {
      setError('Your password must be no more than 72 UTF-8 bytes.');
      return;
    }
    if (!passwordsMatch) {
      setError('The new passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(result.message || 'Password updated successfully.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Password update failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <p className="mb-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
        Confirm your current password, then choose a new one. Your updated password is stored as a secure hash, never as readable text.
      </p>
      <form onSubmit={handleSubmit} className="space-y-5" aria-busy={isSaving}>
        <div>
          <label htmlFor="current-password" className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200">Current password</label>
          <input id="current-password" name="currentPassword" type={showPasswords ? 'text' : 'password'} autoComplete="current-password" required maxLength={72} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </div>
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200">New password</label>
          <input id="new-password" name="newPassword" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={72} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} aria-describedby="password-guidance" className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200">Confirm new password</label>
          <input id="confirm-password" name="confirmPassword" type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required minLength={12} maxLength={72} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-700 focus:ring-4 focus:ring-teal-700/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
        </div>
        <label className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={showPasswords} onChange={(event) => setShowPasswords(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-700" />
          Show passwords
        </label>
        <div id="password-guidance" className="space-y-2 border-l-2 border-slate-200 pl-4 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <p className={`flex items-center gap-2 ${hasMinimumLength ? 'text-teal-800 dark:text-teal-300' : ''}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />At least 12 characters</p>
          <p className={`flex items-center gap-2 ${fitsPasswordLimit ? 'text-teal-800 dark:text-teal-300' : 'text-rose-700 dark:text-rose-300'}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />No more than 72 UTF-8 bytes</p>
          <p className={`flex items-center gap-2 ${passwordsMatch ? 'text-teal-800 dark:text-teal-300' : ''}`}><Check className="h-3.5 w-3.5" aria-hidden="true" />New password entries match</p>
        </div>
        {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200" role="alert">{error}</p>}
        {success && <p className="rounded-md border border-teal-200 bg-teal-50 px-3.5 py-3 text-sm text-teal-900 dark:border-teal-900/70 dark:bg-teal-950/40 dark:text-teal-200" role="status">{success}</p>}
        <button type="submit" disabled={isSaving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-teal-700 dark:hover:bg-teal-600">
          <Lock className="h-4 w-4" aria-hidden="true" />{isSaving ? 'Updating password…' : 'Update password'}
        </button>
      </form>
    </div>
  );
};
