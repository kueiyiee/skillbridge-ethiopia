import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, LoaderCircle, ShieldCheck, ShieldOff } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { api } from '@/src/services/api-client';

type MfaStatus = { totpEnabled: boolean; enabledAt: string | null; recoveryCodesRemaining: number; passkeysEnabled: boolean };

export const MfaSettingsPanel: React.FC = () => {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrollment, setEnrollment] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      setStatus(await api.getMfaStatus());
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'MFA settings could not be loaded.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const startEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setMessage(null);
    try {
      const result = await api.beginTotpEnrollment(currentPassword);
      const qr = qrcode(0, 'M');
      qr.addData(result.otpauthUrl, 'Byte');
      qr.make();
      setEnrollment(result);
      setQrDataUrl(qr.createDataURL(5, 4));
      setCode('');
      setMessage({ kind: 'success', text: 'Scan the QR code with an authenticator app, then enter the current six-digit code to activate MFA.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Authenticator enrollment could not be started.' });
    } finally {
      setWorking(false);
    }
  };

  const confirmEnrollment = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setMessage(null);
    try {
      const result = await api.confirmTotpEnrollment(code.trim());
      setRecoveryCodes(result.recoveryCodes);
      setEnrollment(null);
      setQrDataUrl('');
      setCurrentPassword('');
      setCode('');
      await refresh();
      setMessage({ kind: 'success', text: 'Authenticator MFA is enabled. Save your recovery codes now; they will not be shown again.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Authenticator code could not be verified.' });
    } finally {
      setWorking(false);
    }
  };

  const disable = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorking(true);
    setMessage(null);
    try {
      await api.disableTotp(currentPassword, code.trim());
      setCurrentPassword('');
      setCode('');
      setRecoveryCodes([]);
      await refresh();
      setMessage({ kind: 'success', text: 'Authenticator MFA has been disabled. Your next sign-in will use your password only.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'MFA could not be disabled.' });
    } finally {
      setWorking(false);
    }
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setMessage({ kind: 'error', text: 'Clipboard access is unavailable. Select and copy the recovery codes manually.' });
    }
  };

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:p-5" aria-labelledby="mfa-settings-title">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200"><ShieldCheck className="h-5 w-5"/></span>
        <div className="min-w-0 flex-1">
          <h3 id="mfa-settings-title" className="text-sm font-bold text-slate-950 dark:text-white">Two-factor authentication</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">Add a time-based one-time password from an authenticator app. The server stores an encrypted secret and never receives biometric data.</p>
        </div>
        {loading ? <LoaderCircle className="h-4 w-4 animate-spin text-slate-500"/> : status?.totpEnabled ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Enabled</span> : <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">Not enabled</span>}
      </div>

      {message && <p className={`mt-4 rounded-lg border px-3 py-2 text-xs leading-5 ${message.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'}`} role="status">{message.text}</p>}

      {!loading && status?.totpEnabled && !enrollment && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white p-3 dark:border-emerald-900 dark:bg-slate-900">
            <div><p className="text-xs font-semibold text-slate-900 dark:text-white">Authenticator protection active</p><p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{status.recoveryCodesRemaining} unused recovery codes remaining</p></div>
            <CheckCircle2 className="h-5 w-5 text-emerald-600"/>
          </div>
          <form onSubmit={disable} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
            <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
            <input type="text" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono tracking-widest dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
            <button type="submit" disabled={working || code.length !== 6 || !currentPassword} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-300 px-3 text-xs font-semibold text-rose-800 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"><ShieldOff className="h-4 w-4"/>{working ? 'Working…' : 'Disable MFA'}</button>
          </form>
        </div>
      )}

      {!loading && !status?.totpEnabled && !enrollment && (
        <form onSubmit={startEnrollment} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Confirm your current password" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
          <button type="submit" disabled={working || !currentPassword} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-xs font-semibold text-white disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950"><KeyRound className="h-4 w-4"/>{working ? 'Preparing…' : 'Set up authenticator'}</button>
        </form>
      )}

      {enrollment && (
        <div className="mt-5 grid gap-5 md:grid-cols-[160px_1fr]">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            {qrDataUrl && <img src={qrDataUrl} alt="Authenticator setup QR code" className="h-36 w-36"/>}
            <span className="text-[10px] font-semibold text-slate-500">Scan with your authenticator app</span>
          </div>
          <div className="space-y-3">
            <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">If you cannot scan the QR code, enter this setup key manually in your authenticator app.</p>
            <p className="break-all rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs font-bold tracking-wider text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">{enrollment.secret}</p>
            <form onSubmit={confirmEnrollment} className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input type="text" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter current 6-digit code" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-mono tracking-widest dark:border-slate-700 dark:bg-slate-900 dark:text-white"/>
              <button type="submit" disabled={working || code.length !== 6} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950">{working ? 'Verifying…' : 'Verify & enable'}</button>
            </form>
            <button type="button" onClick={() => { setEnrollment(null); setQrDataUrl(''); setCode(''); }} className="text-xs font-semibold text-slate-500 underline underline-offset-4">Cancel setup</button>
          </div>
        </div>
      )}

      {recoveryCodes.length > 0 && (
        <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-amber-950 dark:text-amber-100">Save your recovery codes</h4>
            <button type="button" onClick={() => void copyRecoveryCodes()} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-amber-400 px-2.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:text-amber-100"><Copy className="h-3.5 w-3.5"/>{copied ? 'Copied' : 'Copy codes'}</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {recoveryCodes.map((recoveryCode) => <code key={recoveryCode} className="rounded-md bg-white px-2 py-2 text-center text-[10px] font-bold tracking-wide text-slate-900 dark:bg-slate-900 dark:text-white">{recoveryCode}</code>)}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-amber-900 dark:text-amber-200">Each recovery code works once. Store them somewhere safe. They cannot be retrieved again after leaving this screen.</p>
          <button type="button" onClick={() => setRecoveryCodes([])} className="mt-2 text-xs font-semibold text-amber-900 underline underline-offset-4 dark:text-amber-200">I have saved these codes</button>
        </div>
      )}
    </section>
  );
};
