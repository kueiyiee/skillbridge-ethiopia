import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, RotateCcw, Search } from 'lucide-react';
import {
  api,
  type AdminManagementEntity,
  type AdminManagementOptions,
  type AdminPageResult,
} from '@/src/services/api-client';

type Field = {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'textarea' | 'select' | 'checkbox' | 'datetime-local';
  required?: boolean;
  createOnly?: boolean;
  options?: Array<{ value: string; label: string }>;
  source?: 'employers' | 'jobs' | 'candidates';
  placeholder?: string;
};

const statuses = (values: string[]) => values.map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const entityDefinitions: Array<{
  id: AdminManagementEntity;
  label: string;
  description: string;
  fields: Field[];
  columns: Array<{ key: string; label: string }>;
}> = [
  {
    id: 'users',
    label: 'Users',
    description: 'Create and maintain candidate and employer accounts. Admin accounts remain provisioned through the secure setup flow.',
    fields: [
      { key: 'fullName', label: 'Full name', required: true },
      { key: 'email', label: 'Email', type: 'email', required: true },
      { key: 'phone', label: 'Phone' },
      { key: 'role', label: 'Account type', type: 'select', createOnly: true, required: true, options: [{ value: 'JOB_SEEKER', label: 'Candidate' }, { value: 'EMPLOYER', label: 'Employer' }] },
      { key: 'password', label: 'Initial password', type: 'password', required: true, createOnly: true, placeholder: 'At least 12 characters' },
    ],
    columns: [{ key: 'fullName', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role' }, { key: 'phone', label: 'Phone' }, { key: 'isActive', label: 'Active' }],
  },
  {
    id: 'employers',
    label: 'Employers',
    description: 'Manage company profiles and their linked employer login. Creating a company also creates its account.',
    fields: [
      { key: 'email', label: 'Account email', type: 'email', required: true, createOnly: true },
      { key: 'fullName', label: 'Account contact name', required: true, createOnly: true },
      { key: 'phone', label: 'Phone', createOnly: true },
      { key: 'password', label: 'Initial password', type: 'password', required: true, createOnly: true, placeholder: 'At least 12 characters' },
      { key: 'companyName', label: 'Company name', required: true },
      { key: 'industry', label: 'Industry', required: true },
      { key: 'city', label: 'City', required: true },
      { key: 'employeeRange', label: 'Employee range', required: true },
      { key: 'address', label: 'Address' },
      { key: 'website', label: 'Website', type: 'text', placeholder: 'https://example.com' },
      { key: 'companyOverview', label: 'Company overview', type: 'textarea' },
    ],
    columns: [{ key: 'companyName', label: 'Company' }, { key: 'email', label: 'Account email' }, { key: 'industry', label: 'Industry' }, { key: 'city', label: 'City' }, { key: 'isApproved', label: 'Verified' }],
  },
  {
    id: 'jobs',
    label: 'Jobs',
    description: 'Create, edit, publish, pause, close, and archive job postings while preserving application history.',
    fields: [
      { key: 'employerId', label: 'Employer', type: 'select', required: true, source: 'employers' },
      { key: 'title', label: 'Job title', required: true },
      { key: 'department', label: 'Department' },
      { key: 'jobType', label: 'Job type', type: 'select', required: true, options: statuses(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'REMOTE', 'HYBRID']) },
      { key: 'city', label: 'City', required: true },
      { key: 'workplaceType', label: 'Workplace type', required: true },
      { key: 'summary', label: 'Summary', type: 'textarea', required: true },
      { key: 'responsibilities', label: 'Responsibilities', type: 'textarea', required: true },
      { key: 'qualifications', label: 'Qualifications', type: 'textarea', required: true },
      { key: 'minExperienceYears', label: 'Minimum experience (years)', type: 'number', required: true },
      { key: 'salaryMinETB', label: 'Minimum salary (ETB)', type: 'number' },
      { key: 'salaryMaxETB', label: 'Maximum salary (ETB)', type: 'number' },
      { key: 'isSalaryNegotiable', label: 'Salary negotiable', type: 'checkbox' },
      { key: 'status', label: 'Status', type: 'select', required: true, options: statuses(['DRAFT', 'ACTIVE', 'PAUSED', 'CLOSED']) },
      { key: 'deadline', label: 'Application deadline', type: 'datetime-local' },
    ],
    columns: [{ key: 'title', label: 'Title' }, { key: 'companyName', label: 'Employer' }, { key: 'jobType', label: 'Type' }, { key: 'status', label: 'Status' }, { key: 'deadline', label: 'Deadline' }],
  },
  {
    id: 'applications',
    label: 'Applications',
    description: 'Manage application records and workflow stages without removing candidate or job history.',
    fields: [
      { key: 'jobId', label: 'Job', type: 'select', required: true, source: 'jobs' },
      { key: 'jobSeekerId', label: 'Candidate', type: 'select', required: true, source: 'candidates' },
      { key: 'status', label: 'Status', type: 'select', required: true, options: statuses(['APPLIED', 'SCREENING', 'TECHNICAL_ASSESSMENT', 'INTERVIEW_SCHEDULED', 'OFFERED', 'REJECTED', 'WITHDRAWN']) },
      { key: 'matchScore', label: 'Match score (%)', type: 'number', required: true },
      { key: 'coverNote', label: 'Cover note', type: 'textarea' },
      { key: 'statusNotes', label: 'Status notes', type: 'textarea' },
    ],
    columns: [{ key: 'candidateName', label: 'Candidate' }, { key: 'jobTitle', label: 'Job' }, { key: 'status', label: 'Status' }, { key: 'matchScore', label: 'Match' }, { key: 'appliedAt', label: 'Applied' }],
  },
];

function initialValue(field: Field): unknown {
  if (field.type === 'checkbox') return false;
  if (field.type === 'number') return 0;
  if (field.key === 'role') return 'JOB_SEEKER';
  if (field.key === 'status') return field.options?.[0]?.value ?? '';
  return '';
}

function displayValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(value).toLocaleDateString();
  return String(value);
}

function editableText(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) return parsed.join('\n');
  } catch {
    return value;
  }
  return value;
}

function formatFieldValue(field: Field, value: unknown): unknown {
  if (field.type === 'checkbox') return Boolean(value);
  if (field.type === 'number') return value === '' || value === null ? null : Number(value);
  if (field.type === 'datetime-local') return value ? new Date(String(value)).toISOString() : null;
  return value === '' ? null : value;
}

export const AdminManagement: React.FC = () => {
  const [entity, setEntity] = useState<AdminManagementEntity>('users');
  const [records, setRecords] = useState<AdminPageResult<Record<string, unknown>> | null>(null);
  const [options, setOptions] = useState<AdminManagementOptions | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Record<string, unknown> | null>(null);
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const formDialogRef = useRef<HTMLDivElement>(null);

  const definition = entityDefinitions.find((item) => item.id === entity)!;

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setSelectedRecord(null);
    setFormValues({});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getAdminManagedRecords(entity, {
        page,
        pageSize: 25,
        search: search || undefined,
        includeArchived,
      });
      setRecords(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Records could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [entity, includeArchived, page, search]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    api.getAdminManagementOptions().then(setOptions).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : 'Related record options could not be loaded.');
    });
  }, []);

  useEffect(() => {
    if (!formOpen) return;
    const dialog = formDialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])');
    focusable?.[0]?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeForm();
        return;
      }
      if (event.key !== 'Tab' || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener('keydown', handleKeyDown);
    return () => dialog?.removeEventListener('keydown', handleKeyDown);
  }, [closeForm, formOpen]);

  const fields = useMemo(
    () => definition.fields.filter((field) => selectedRecord ? !field.createOnly : true),
    [definition.fields, selectedRecord],
  );

  const openForm = (record: Record<string, unknown> | null) => {
    setSelectedRecord(record);
    const values: Record<string, unknown> = {};
    for (const field of definition.fields) {
      let value = record?.[field.key];
      if (field.key === 'password') value = '';
      if (entity === 'jobs' && (field.key === 'responsibilities' || field.key === 'qualifications')) value = editableText(value);
      if (field.type === 'datetime-local' && value) value = new Date(String(value)).toISOString().slice(0, 16);
      values[field.key] = value ?? initialValue(field);
    }
    setFormValues(values);
    setError(null);
    setFormOpen(true);
  };

  const submitForm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = Object.fromEntries(fields
      .filter((field) => formValues[field.key] !== undefined)
      .map((field) => [field.key, formatFieldValue(field, formValues[field.key])]));
    if (selectedRecord && !payload.password) delete payload.password;
    try {
      if (selectedRecord) {
        await api.updateAdminManagedRecord(entity, String(selectedRecord.id), payload);
      } else {
        await api.createAdminManagedRecord(entity, payload);
      }
      closeForm();
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The record could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const archiveRecord = async (record: Record<string, unknown>) => {
    if (!window.confirm('Archive this record? Linked history will be preserved.')) return;
    setError(null);
    try {
      await api.archiveAdminManagedRecord(entity, String(record.id));
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The record could not be archived.');
    }
  };

  const restoreRecord = async (record: Record<string, unknown>) => {
    setError(null);
    try {
      await api.restoreAdminManagedRecord(entity, String(record.id));
      await loadData();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The record could not be restored.');
    }
  };

  const optionsFor = (field: Field) => {
    if (!field.source || !options) return [];
    return options[field.source];
  };

  return (
    <section className="space-y-4 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur-md dark:border-slate-700/70 dark:bg-slate-900/55 sm:p-5" aria-label="Admin data management">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Record type">
          {entityDefinitions.map((item) => (
            <button key={item.id} type="button" aria-pressed={entity === item.id}
              onClick={() => { setEntity(item.id); setPage(1); setRecords(null); setError(null); }}
              className={`min-h-9 rounded-lg px-3 text-xs font-semibold ${entity === item.id ? 'bg-cyan-700 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => openForm(null)} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-cyan-700 px-3 text-xs font-semibold text-white hover:bg-cyan-800">
          <Plus className="h-4 w-4" aria-hidden="true" /> Add {definition.label.slice(0, -1)}
        </button>
        <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-700">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" /> Refresh
        </button>
      </div>

      <p className="text-xs text-slate-600 dark:text-slate-400">{definition.description}</p>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <form className="flex min-w-[min(100%,20rem)] flex-1 gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }}>
          <label className="sr-only" htmlFor="admin-management-search">Search records</label>
          <input id="admin-management-search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={`Search ${definition.label.toLowerCase()}…`} className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" />
          <button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold dark:border-slate-700"><Search className="h-4 w-4" aria-hidden="true" /> Search</button>
        </form>
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={includeArchived} onChange={(event) => { setIncludeArchived(event.target.checked); setPage(1); }} />
          Include archived
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[680px] text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
            <tr>{definition.columns.map((column) => <th key={column.key} className="px-3 py-3 font-semibold">{column.label}</th>)}<th className="px-3 py-3 text-right font-semibold">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && <tr><td colSpan={definition.columns.length + 1} className="px-3 py-8 text-center text-slate-500">Loading records…</td></tr>}
            {!loading && records?.data.length === 0 && <tr><td colSpan={definition.columns.length + 1} className="px-3 py-8 text-center text-slate-500">No matching records.</td></tr>}
            {!loading && records?.data.map((record) => {
              const archived = Boolean(record.archivedAt);
              return <tr key={String(record.id)} className={archived ? 'bg-slate-50/70 opacity-70 dark:bg-slate-950/30' : ''}>
                {definition.columns.map((column) => <td key={column.key} className="max-w-[240px] truncate px-3 py-3 text-slate-700 dark:text-slate-200" title={displayValue(record[column.key])}>{displayValue(record[column.key])}</td>)}
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {archived
                    ? <button type="button" onClick={() => void restoreRecord(record)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-emerald-300 px-2 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-200"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Restore</button>
                    : <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => openForm(record)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-300 px-2 text-[10px] font-semibold hover:border-cyan-600 dark:border-slate-700">Edit</button>
                      <button type="button" onClick={() => void archiveRecord(record)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-amber-300 px-2 text-[10px] font-semibold text-amber-800 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-200">Archive</button>
                    </div>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>

      {records && <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <span>{records.count} records · Page {records.page} of {Math.max(records.totalPages, 1)}</span>
        <div className="flex gap-2">
          <button type="button" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Previous</button>
          <button type="button" disabled={loading || page >= records.totalPages} onClick={() => setPage((current) => current + 1)} className="min-h-9 rounded-md border border-slate-300 px-3 font-semibold disabled:opacity-40 dark:border-slate-700">Next</button>
        </div>
      </div>}

      {formOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation">
        <div ref={formDialogRef} role="dialog" aria-modal="true" aria-labelledby="admin-record-form-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div><h3 id="admin-record-form-title" className="text-lg font-bold">{selectedRecord ? 'Edit' : 'Create'} {definition.label.slice(0, -1)}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Changes are recorded in the admin audit log.</p></div>
            <button type="button" onClick={closeForm} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Close</button>
          </div>
          <form onSubmit={submitForm} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((field) => <label key={`${field.key}-${field.createOnly ? 'create' : 'edit'}`} className={`block text-xs font-semibold text-slate-700 dark:text-slate-200 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                <span className="mb-1.5 block">{field.label}{(field.required || (entity === 'verifications' && field.key === 'reviewNotes' && formValues.status !== 'PENDING')) && <span className="text-rose-600"> *</span>}</span>
                {field.type === 'textarea'
                  ? <textarea required={field.required || (entity === 'verifications' && field.key === 'reviewNotes' && formValues.status !== 'PENDING')} minLength={entity === 'verifications' && field.key === 'reviewNotes' && formValues.status !== 'PENDING' ? 3 : undefined} rows={3} value={String(formValues[field.key] ?? '')} onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950" />
                  : field.type === 'checkbox'
                    ? <input type="checkbox" checked={Boolean(formValues[field.key])} onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.checked }))} className="ml-1 h-4 w-4 accent-cyan-700" />
                    : field.type === 'select'
                      ? <select required={field.required} value={String(formValues[field.key] ?? '')} onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: event.target.value }))} className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950">
                        <option value="">Select…</option>
                        {(field.options ?? optionsFor(field).map((option) => ({ value: option.id, label: option.label }))).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                      : <input
                        type={field.type ?? 'text'}
                        required={field.required && !(selectedRecord && field.key === 'password')}
                        min={field.type === 'number' ? '0' : undefined}
                        step={field.type === 'number' ? '1' : undefined}
                        minLength={field.type === 'password' && field.required ? 12 : undefined}
                        maxLength={field.type === 'password' ? 128 : undefined}
                        placeholder={field.placeholder}
                        value={field.type === 'number' ? String(formValues[field.key] ?? '') : String(formValues[field.key] ?? '')}
                        onChange={(event) => setFormValues((current) => ({ ...current, [field.key]: field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value }))}
                        className="min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
                      />}
              </label>)}
            </div>
            {error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button type="button" onClick={closeForm} className="min-h-10 rounded-lg border border-slate-300 px-4 text-xs font-semibold dark:border-slate-700">Cancel</button>
              <button type="submit" disabled={saving} className="min-h-10 rounded-lg bg-cyan-700 px-4 text-xs font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : selectedRecord ? 'Save changes' : 'Create record'}</button>
            </div>
          </form>
        </div>
      </div>}
    </section>
  );
};
