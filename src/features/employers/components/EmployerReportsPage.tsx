import React, { useEffect, useState } from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';
import { api, type EmployerReport, type EmployerReportType } from '@/src/services/api-client';

interface EmployerReportsPageProps {
  isVerified: boolean;
}

const initialReportTypes: Array<{ type: EmployerReportType; label: string; dateBasis: string }> = [
  { type: 'job-performance', label: 'Job performance', dateBasis: 'Application submission date' },
  { type: 'applications', label: 'Applications', dateBasis: 'Application submission date' },
  { type: 'pipeline', label: 'Recruitment pipeline', dateBasis: 'Application submission date' },
  { type: 'candidate-activity', label: 'Candidate activity', dateBasis: 'Application submission date' },
];

export const EmployerReportsPage: React.FC<EmployerReportsPageProps> = ({ isVerified }) => {
  const [reportTypes, setReportTypes] = useState(initialReportTypes);
  const [reportType, setReportType] = useState<EmployerReportType>('job-performance');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [report, setReport] = useState<EmployerReport | null>(null);
  const [page, setPage] = useState(1);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    api.getEmployerReports().then((types) => {
      if (current) setReportTypes(types);
    }).catch((loadError: unknown) => {
      if (current) setError(loadError instanceof Error ? loadError.message : 'Reports could not be loaded.');
    }).finally(() => {
      if (current) setLoadingTypes(false);
    });
    return () => { current = false; };
  }, []);

  const generatePreview = async (requestedPage = 1) => {
    setLoading(true);
    setError(null);
    setExportNotice(null);
    try {
      setReport(await api.getEmployerReport(reportType, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: requestedPage,
        pageSize: 25,
      }));
      setPage(requestedPage);
    } catch (previewError) {
      setReport(null);
      setError(previewError instanceof Error ? previewError.message : 'Report preview could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async (format: 'csv' | 'pdf') => {
    setExporting(true);
    setError(null);
    setExportNotice(null);
    try {
      const result = await api.exportEmployerReport(reportType, {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }, format);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportNotice(result.truncated
        ? `Downloaded ${result.filename} with ${result.recordCount.toLocaleString()} records (export limit reached). Narrow the date range to include fewer records.`
        : `Downloaded ${result.filename} with ${result.recordCount.toLocaleString()} records. ${format === 'pdf' ? 'The A4 PDF includes a unique report ID, QR verification link, and barcode reference.' : ''}`);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'CSV export could not be generated.');
    } finally {
      setExporting(false);
    }
  };

  const selectedReport = reportTypes.find((item) => item.type === reportType);

  if (!isVerified) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100" role="status">
        Employer reports are available after your organization has been verified.
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="employer-reports-title">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Recruitment insights</p>
          <h2 id="employer-reports-title" className="mt-1 text-xl font-bold text-slate-950 dark:text-white">Reports &amp; Exports</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Reports include records associated with your verified organization only.</p>
        </div>
        <FileText className="mt-1 h-5 w-5 text-cyan-700 dark:text-cyan-300" aria-hidden="true" />
      </header>

      <form
        className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.4fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto_auto_auto]"
        onSubmit={(event) => { event.preventDefault(); void generatePreview(); }}
      >
        <label className="grid gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Report type
          <select value={reportType} onChange={(event) => { setReportType(event.target.value as EmployerReportType); setReport(null); }} disabled={loadingTypes || loading}>
            {reportTypes.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Start date
          <input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
          End date
          <input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <button type="submit" disabled={loading || loadingTypes} className="self-end inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />{loading ? 'Generating…' : 'Generate preview'}
        </button>
        <button type="button" onClick={() => void exportReport('csv')} disabled={exporting || loadingTypes} className="self-end inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-800 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200">
          <Download className="h-4 w-4" aria-hidden="true" />{exporting ? 'Preparing…' : 'Download CSV'}
        </button>
        <button type="button" onClick={() => void exportReport('pdf')} disabled={exporting || loadingTypes} className="self-end inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 text-sm font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400">
          <FileText className="h-4 w-4" aria-hidden="true" />{exporting ? 'Preparing…' : 'Download A4 PDF'}
        </button>
      </form>

      {selectedReport && <p className="text-xs text-slate-500 dark:text-slate-400">
        {selectedReport.label} · Date range filters by {selectedReport.dateBasis.toLowerCase()}; end date is inclusive.
      </p>}
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">{error}<button type="button" onClick={() => void generatePreview(page)} className="ml-3 font-semibold underline">Retry preview</button></div>}
      {exportNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">{exportNotice}</p>}
      {loading && <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900" role="status">Loading report records…</p>}

      {report && !loading && <>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h3 className="font-bold text-slate-950 dark:text-white">{selectedReport?.label} preview</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Generated {new Date(report.generatedAt).toLocaleString()} · {report.period.startDate || 'Any start'} – {report.period.endDate || 'Any end'}</p></div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{report.totalRecords.toLocaleString()} matching records</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {report.summary.map((metric) => <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{metric.label}</p><p className="mt-1 text-xl font-bold tabular-nums text-slate-950 dark:text-white">{typeof metric.value === 'number' ? metric.value.toLocaleString() : metric.value}</p></article>)}
        </div>
        {report.rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">No records match this report and date range.</div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <table className="min-w-full text-left text-xs">
              <thead><tr>{report.columns.map((column) => <th key={column.key} className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">{column.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {report.rows.map((row, index) => <tr key={String(row.applicationId || row.jobId || row.candidateProfileId || row.status || index)}>
                  {report.columns.map((column) => {
                    const value = row[column.key];
                    const display = column.type === 'date' && value ? new Date(String(value)).toLocaleDateString() : value === null || value === undefined || value === '' ? '—' : String(value);
                    return <td key={column.key} className="max-w-xs whitespace-nowrap px-3 py-2.5 text-slate-700 dark:text-slate-200">{display}</td>;
                  })}
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
        {report.totalPages > 1 && <nav className="flex items-center justify-between gap-3" aria-label="Report preview pagination">
          <button type="button" disabled={page <= 1 || loading} onClick={() => void generatePreview(page - 1)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">Previous</button>
          <span className="text-xs text-slate-500 dark:text-slate-400">Page {report.page} of {report.totalPages}</span>
          <button type="button" disabled={page >= report.totalPages || loading} onClick={() => void generatePreview(page + 1)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">Next</button>
        </nav>}
      </>}
    </section>
  );
};
