import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { createAdminReportFile, safeSpreadsheetText } from './admin.reports.export';
import type { AdminReportResult } from './admin.reports';

function sampleReport(rowCount = 1): AdminReportResult {
  const rows = Array.from({ length: rowCount }, (_, index) => ({
    companyName: index === 0 ? '=HYPERLINK("https://example.invalid")' : `Employer ${index}`,
    note: index === 0 ? 'Quoted, line\nnext: "value" የኢትዮጵያ' : `Review note ${index}`,
    createdAt: new Date('2026-10-21T08:30:00.000Z'),
    count: index,
  }));
  return {
    type: 'employer-verification',
    title: 'Employer Verification Report',
    generatedAt: '2026-10-21T09:00:00.000Z',
    period: { startDate: '2026-10-01', endDate: '2026-10-21', endDateInclusive: true, timeZone: 'database session timezone' },
    filters: { startDate: '2026-10-01', endDate: '2026-10-21', status: 'PENDING' },
    summary: [{ label: 'Pending', value: rowCount }],
    columns: [
      { key: 'companyName', label: 'Organization', type: 'text' },
      { key: 'note', label: 'Decision reason', type: 'text' },
      { key: 'createdAt', label: 'Submitted at', type: 'date' },
      { key: 'count', label: 'Records', type: 'number' },
    ],
    rows,
    totalRecords: rowCount,
    includedRecords: rowCount,
    truncated: false,
    notes: ['Submitted files are not exported.'],
  };
}

test('CSV export quotes special text, preserves UTF-8, and prevents formula injection', async () => {
  const file = await createAdminReportFile(sampleReport(), 'csv');
  const csv = file.buffer.toString('utf8');
  assert.equal(file.contentType, 'text/csv; charset=utf-8');
  assert.equal(csv.charCodeAt(0), 0xfeff);
  assert.match(csv, /'=?HYPERLINK/);
  assert.match(csv, /"Quoted, line\nnext: ""value"" የኢትዮጵያ"/);
  assert.match(csv, /Organization,Decision reason,Submitted at,Records/);
  assert.equal(safeSpreadsheetText('=1+1'), "'=1+1");
  assert.equal(safeSpreadsheetText('ordinary text'), 'ordinary text');
});

test('XLSX export has typed dates, summary metadata, frozen header, and filters', async () => {
  const file = await createAdminReportFile(sampleReport(), 'xlsx');
  const workbook = new ExcelJS.Workbook();
  const excelBuffer = file.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(excelBuffer);
  const summary = workbook.getWorksheet('Summary');
  const data = workbook.getWorksheet('Employer_Verification_Report');
  assert.ok(summary);
  assert.ok(data);
  assert.equal(summary.getCell('A2').value, 'Report');
  assert.equal(summary.getCell('B2').value, 'Employer Verification Report');
  assert.equal(data.getCell('A2').value, "'=HYPERLINK(\"https://example.invalid\")");
  assert.ok(data.getCell('C2').value instanceof Date);
  assert.equal(data.views[0].state, 'frozen');
  assert.ok(data.autoFilter);
});

test('PDF export embeds Ethiopic font glyphs and paginates long reports', async () => {
  const file = await createAdminReportFile(sampleReport(120), 'pdf');
  const pdf = file.buffer.toString('latin1');
  assert.equal(file.contentType, 'application/pdf');
  assert.ok(pdf.startsWith('%PDF-'));
  assert.match(pdf, /\/FontFile2/);
  assert.ok((pdf.match(/\/Type \/Page\b/g) ?? []).length > 1);
  assert.match(file.filename, /^SKILLBRIDGE_ET_Employer_Verification_Report_2026-10-21\.pdf$/);
});

test('empty exports retain descriptive headers and report metadata', async () => {
  const report = sampleReport(0);
  const csv = await createAdminReportFile(report, 'csv');
  const pdf = await createAdminReportFile(report, 'pdf');
  assert.match(csv.buffer.toString('utf8'), /Employer Verification Report/);
  const pdfSource = pdf.buffer.toString('latin1');
  assert.match(pdfSource, /%PDF-/);
  assert.equal((pdfSource.match(/\/Type \/Page\b/g) ?? []).length, 1);
  assert.equal(report.totalRecords, 0);
  assert.equal(report.rows.length, 0);
});