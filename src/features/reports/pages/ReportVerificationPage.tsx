import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BadgeCheck, Copy, LoaderCircle, ShieldCheck, ShieldX } from 'lucide-react';
import { api, type PublicReportVerification } from '@/src/services/api-client';

export const ReportVerificationPage: React.FC = () => {
  const { reportId = '' } = useParams<{ reportId: string }>();
  const [result, setResult] = useState<{ valid: boolean; verification: PublicReportVerification } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.verifyIssuedReport(reportId)
      .then((response) => { if (active) setResult(response); })
      .catch((requestError: unknown) => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Verification could not be completed.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reportId]);

  const copyFingerprint = async () => {
    if (!result?.verification.reportHash) return;
    try {
      await navigator.clipboard.writeText(result.verification.reportHash);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access is unavailable. You can select and copy the fingerprint manually.');
    }
  };

  return (
    <main className="min-h-[75vh] bg-slate-50 px-4 py-12 dark:bg-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-cyan-700 dark:text-slate-300 dark:hover:text-cyan-300">
          <ArrowLeft className="h-4 w-4" /> SKILLBRIDGE ET
        </Link>
        <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900">
          <header className="bg-[#0b1727] px-6 py-7 text-white sm:px-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">Document authenticity service</p>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Report verification</h1>
            <p className="mt-2 text-sm text-slate-300">Check whether this report reference was issued by SKILLBRIDGE Ethiopia.</p>
          </header>
          <div className="p-6 sm:p-8">
            {loading && <div className="flex items-center gap-3 py-12 text-sm text-slate-600 dark:text-slate-300" role="status"><LoaderCircle className="h-5 w-5 animate-spin" /> Checking the official report registry…</div>}
            {!loading && error && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="alert">
                <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" /> Verification unavailable</div>
                <p className="mt-2 text-sm leading-6">{error}</p>
                <p className="mt-3 break-all text-xs opacity-80">Reference: {reportId}</p>
              </div>
            )}
            {!loading && result && (
              <>
                <div className={`flex items-start gap-4 rounded-2xl border p-5 ${result.valid ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30' : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}>
                  {result.valid ? <ShieldCheck className="mt-0.5 h-7 w-7 shrink-0 text-emerald-700 dark:text-emerald-300" /> : <ShieldX className="mt-0.5 h-7 w-7 shrink-0 text-rose-700 dark:text-rose-300" />}
                  <div>
                    <h2 className={`text-lg font-bold ${result.valid ? 'text-emerald-950 dark:text-emerald-100' : 'text-rose-950 dark:text-rose-100'}`}>{result.valid ? 'Issued report record found' : 'This report has been revoked'}</h2>
                    <p className={`mt-1 text-sm leading-6 ${result.valid ? 'text-emerald-900 dark:text-emerald-200' : 'text-rose-900 dark:text-rose-200'}`}>{result.valid ? 'The reference exists in the official SKILLBRIDGE ET registry and is currently marked valid.' : 'The reference exists, but the issuer has revoked this report record. Do not accept it as a currently valid report.'}</p>
                  </div>
                </div>
                <dl className="mt-7 grid gap-5 sm:grid-cols-2">
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report title</dt><dd className="mt-1 font-semibold text-slate-950 dark:text-white">{result.verification.reportTitle}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report category</dt><dd className="mt-1 font-semibold capitalize text-slate-950 dark:text-white">{result.verification.reportType.replaceAll('-', ' ')}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Issued by</dt><dd className="mt-1 font-semibold text-slate-950 dark:text-white">{result.verification.issuerRole === 'ADMIN' ? 'Platform Administration' : 'Verified Employer Workspace'}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Generated</dt><dd className="mt-1 font-semibold text-slate-950 dark:text-white">{new Date(result.verification.generatedAt).toLocaleString()}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Records represented</dt><dd className="mt-1 font-semibold tabular-nums text-slate-950 dark:text-white">{result.verification.recordCount.toLocaleString()}</dd></div>
                  <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Report reference</dt><dd className="mt-1 font-mono text-sm font-bold text-slate-950 dark:text-white">{result.verification.reportId}</dd></div>
                </dl>
                <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">SHA-256 report-data fingerprint</h3>
                    <button type="button" onClick={() => void copyFingerprint()} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:border-cyan-500 dark:border-slate-700 dark:text-slate-200"><Copy className="h-3.5 w-3.5"/>{copied ? 'Copied' : 'Copy'}</button>
                  </div>
                  <p className="mt-3 break-all font-mono text-xs leading-6 text-slate-600 dark:text-slate-300">{result.verification.reportHash}</p>
                </div>
                <p className="mt-5 text-xs leading-5 text-slate-500 dark:text-slate-400">This registry confirms issuance and the stored report-data fingerprint. Compare the reference and fingerprint printed on the document. The QR result alone does not prove that a separately altered PDF copy is unchanged.</p>
              </>
            )}
          </div>
          <footer className="flex items-center justify-between border-t border-slate-100 px-6 py-4 dark:border-slate-800 sm:px-8">
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500"><BadgeCheck className="h-4 w-4"/> SKILLBRIDGE ET</span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Official verification</span>
          </footer>
        </section>
      </div>
    </main>
  );
};
