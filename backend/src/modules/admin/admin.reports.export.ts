import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';
import { resolve } from 'node:path';
import { ADMIN_REPORT_ROW_LIMIT, type AdminReportResult, type ReportValueType } from './admin.reports';
import { drawReportBarcode, drawReportQr } from '../report-verification/report-identity.pdf';
import type { IssuedReportIdentity } from '../report-verification/report-verification.service';

export type AdminReportFormat = 'pdf' | 'xlsx' | 'csv';

export interface AdminReportFile {
  buffer: Buffer;
  contentType: string;
  extension: string;
  filename: string;
}

const latinFontPath = resolve(process.cwd(), 'node_modules/@fontsource/noto-sans-ethiopic/files/noto-sans-ethiopic-latin-400-normal.woff');
const ethiopicFontPath = resolve(process.cwd(), 'node_modules/@fontsource/noto-sans-ethiopic/files/noto-sans-ethiopic-ethiopic-400-normal.woff');
const ethiopicCharacters = /[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]/u;

export function safeSpreadsheetText(value: string): string {
  return /^[\s]*[=+\-@]/u.test(value) ? `'${value}` : value;
}

function cellValue(value: unknown, type: ReportValueType): string | number | boolean | Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (type === 'date') {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.valueOf()) ? String(value) : date;
  }
  if (type === 'number' && typeof value === 'number') return value;
  if (type === 'boolean' && typeof value === 'boolean') return value;
  if (typeof value === 'string') return safeSpreadsheetText(value);
  return String(value);
}

function formatDate(value: string | null): string {
  return value ?? 'All available dates';
}

function filterSummary(report: AdminReportResult): string {
  const values = Object.entries(report.filters).filter(([, value]) => value !== undefined && value !== '');
  return values.length ? values.map(([key, value]) => `${key}: ${value}`).join(' · ') : 'No additional filters';
}

function safeFilenamePart(value: string): string {
  return value.normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function createFilename(report: AdminReportResult, extension: string): string {
  const date = report.generatedAt.slice(0, 10);
  return `SKILLBRIDGE_ET_${safeFilenamePart(report.title)}_${date}.${extension}`;
}

async function createXlsx(report: AdminReportResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SKILLBRIDGE ET';
  workbook.created = new Date(report.generatedAt);
  workbook.subject = report.title;

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 38 }, { width: 54 }];
  summary.addRow(['SKILLBRIDGE ET', 'Governance reporting']);
  summary.addRow(['Report', report.title]);
  summary.addRow(['Generated at (UTC)', report.generatedAt]);
  summary.addRow(['Start date', formatDate(report.period.startDate)]);
  summary.addRow(['End date (inclusive)', formatDate(report.period.endDate)]);
  summary.addRow(['Timezone', report.period.timeZone]);
  summary.addRow(['Filters', filterSummary(report)]);
  summary.addRow(['Records matching filters', report.totalRecords]);
  summary.addRow(['Records included', report.includedRecords]);
  summary.addRow(['Export limit reached', report.truncated ? 'Yes' : 'No']);
  summary.addRow([]);
  summary.addRow(['Summary metric', 'Value']);
  for (const metric of report.summary) summary.addRow([metric.label, metric.value]);
  if (report.notes.length) {
    summary.addRow([]);
    summary.addRow(['Notes', '']);
    for (const note of report.notes) summary.addRow([note, '']);
  }
  summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF10243C' } };
  summary.getRow(12).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16415E' } };
  summary.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });
  summary.views = [{ state: 'frozen', ySplit: 1 }];

  const dataName = safeFilenamePart(report.title).slice(0, 28) || 'Data';
  const data = workbook.addWorksheet(dataName);
  data.columns = report.columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: Math.min(42, Math.max(14, column.label.length + 3)),
    style: column.type === 'date' ? { numFmt: 'yyyy-mm-dd hh:mm' } : column.type === 'number' ? { numFmt: '#,##0.##' } : {},
  }));
  data.addRows(report.rows.map((row) => Object.fromEntries(report.columns.map((column) => [column.key, cellValue(row[column.key], column.type)]))));
  data.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  data.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16415E' } };
  data.getRow(1).alignment = { vertical: 'middle', wrapText: true };
  data.views = [{ state: 'frozen', ySplit: 1 }];
  if (report.columns.length) data.autoFilter = { from: 'A1', to: { row: 1, column: report.columns.length } };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function createCsv(report: AdminReportResult): Buffer {
  const columns = [
    { key: 'report', header: 'Report' },
    { key: 'generatedAt', header: 'Generated at (UTC)' },
    { key: 'startDate', header: 'Start date' },
    { key: 'endDate', header: 'End date (inclusive)' },
    ...report.columns.map(({ key, label }) => ({ key, header: label })),
  ];
  const rows = report.rows.length
    ? report.rows.map((row) => ({
      report: report.title,
      generatedAt: report.generatedAt,
      startDate: report.period.startDate ?? '',
      endDate: report.period.endDate ?? '',
      ...Object.fromEntries(report.columns.map((column) => [column.key, row[column.key] ?? ''])),
    }))
    : [{ report: report.title, generatedAt: report.generatedAt, startDate: report.period.startDate ?? '', endDate: report.period.endDate ?? '' }];
  const safeRows = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, rawValue]) => {
    const value: unknown = rawValue;
    return [
    key,
    typeof value === 'string' ? safeSpreadsheetText(value) : value instanceof Date ? value.toISOString() : value,
    ];
  })));
  const csv = stringify(safeRows, { header: true, columns, bom: true, record_delimiter: 'windows' });
  return Buffer.from(csv, 'utf8');
}

function textSegments(text: string): string[] {
  return text.match(/[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]+|[^\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]+/gu) ?? [''];
}

function measureRichText(doc: PDFKit.PDFDocument, text: string, width: number, size: number): number {
  const total = textSegments(text).reduce((height, segment) => {
    doc.font(ethiopicCharacters.test(segment) ? 'Ethiopic' : 'Latin').fontSize(size);
    return height + doc.heightOfString(segment, { width, lineGap: 1 });
  }, 0);
  return Math.max(size + 3, total);
}

function drawRichText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  const segments = textSegments(text);
  segments.forEach((segment, index) => {
    doc.font(ethiopicCharacters.test(segment) ? 'Ethiopic' : 'Latin').fontSize(size).fillColor(color);
    const options: PDFKit.Mixins.TextOptions = { width, height, lineGap: 1, align, continued: index < segments.length - 1 };
    if (index === 0) {
      doc.text(segment, x, y, options);
    } else {
      doc.text(segment, options);
    }
  });
}

function createPdf(report: AdminReportResult, verification?: IssuedReportIdentity): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: report.columns.length > 5 ? 'landscape' : 'portrait', margin: 42, bufferPages: true, info: { Title: report.title, Author: 'SKILLBRIDGE ET', Subject: 'Digitally verifiable SKILLBRIDGE ET report' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.registerFont('Latin', latinFontPath);
    doc.registerFont('Ethiopic', ethiopicFontPath);

    const left = 42;
    const right = 42;
    const footerMargin = 44;
    const pageWidth = () => doc.page.width - left - right;
    const topContent = () => 42;
    const bottomContent = () => doc.page.height - footerMargin;

    drawRichText(doc, 'SKILLBRIDGE ET  |  GOVERNANCE', left, 28, pageWidth(), 16, 8, '#16415E');
    doc.moveDown(0.9);
    drawRichText(doc, report.title, left, 54, pageWidth(), 30, 18, '#10243C');
    drawRichText(doc, 'Platform governance reporting', left, 82, pageWidth(), 18, 10, '#475569');
    let y = 112;
    const metadata = [
      `Generated at: ${report.generatedAt}`,
      `Reporting period: ${formatDate(report.period.startDate)} to ${formatDate(report.period.endDate)} (end date inclusive)`,
      `Filters: ${filterSummary(report)}`,
      `Records: ${report.includedRecords} included of ${report.totalRecords}${report.truncated ? ` (limited to ${ADMIN_REPORT_ROW_LIMIT})` : ''}`,
    ];
    for (const line of metadata) {
      const height = measureRichText(doc, line, pageWidth(), 8.5) + 3;
      drawRichText(doc, line, left, y, pageWidth(), height, 8.5, '#334155');
      y += height;
    }
    y += 8;
    drawRichText(doc, 'Executive summary', left, y, pageWidth(), 16, 11, '#10243C');
    y += 19;
    for (const metric of report.summary) {
      const line = `${metric.label}: ${metric.value}`;
      const height = measureRichText(doc, line, pageWidth(), 8.5) + 3;
      if (y + height > bottomContent()) { doc.addPage(); y = topContent(); }
      drawRichText(doc, line, left, y, pageWidth(), height, 8.5, '#334155');
      y += height;
    }
    if (report.notes.length) {
      y += 5;
      for (const note of report.notes) {
        const height = measureRichText(doc, note, pageWidth(), 7.5) + 3;
        if (y + height > bottomContent()) { doc.addPage(); y = topContent(); }
        drawRichText(doc, note, left, y, pageWidth(), height, 7.5, '#64748B');
        y += height;
      }
    }

    y += 10;
    const available = pageWidth();
    const weights = report.columns.map((column) => Math.min(22, Math.max(6, column.label.length)));
    const totalWeight = weights.reduce((sum, value) => sum + value, 0) || 1;
    const widths = weights.map((weight) => available * weight / totalWeight);
    const headers = report.columns.map((column) => column.label);
    const headerHeight = Math.max(24, ...headers.map((value, index) => measureRichText(doc, value, widths[index] - 10, 7.5) + 8));
    const drawHeader = () => {
      doc.save().fillColor('#16415E').rect(left, y, available, headerHeight).fill().restore();
      let x = left;
      headers.forEach((header, index) => {
        drawRichText(doc, header, x + 5, y + 4, widths[index] - 10, headerHeight - 8, 7.5, '#FFFFFF');
        x += widths[index];
      });
      y += headerHeight;
    };
    drawRichText(doc, 'Report details', left, y, pageWidth(), 16, 11, '#10243C');
    y += 20;
    drawHeader();

    const appendix: Array<{ record: number; label: string; value: string }> = [];
    if (report.rows.length === 0) {
      const emptyHeight = 32;
      doc.save().fillColor('#F1F5F9').rect(left, y, available, emptyHeight).fill().restore();
      drawRichText(doc, 'No records match the selected filters.', left + 6, y + 9, available - 12, 16, 8.5, '#475569');
      y += emptyHeight;
    } else {
      report.rows.forEach((row, rowIndex) => {
        const values = report.columns.map((column) => {
          const value = row[column.key];
          if (value === null || value === undefined || value === '') return '—';
          if (value instanceof Date) return value.toISOString();
          return String(value);
        });
        const tableValues = values.map((value, index) => {
          if (value.length <= 180) return value;
          appendix.push({ record: rowIndex + 1, label: report.columns[index].label, value });
          return '[Full value in appendix]';
        });
        const cellHeights = tableValues.map((value, index) => measureRichText(doc, value, widths[index] - 10, 7.2));
        const rowHeight = Math.max(22, ...cellHeights) + 8;
        if (y + rowHeight > bottomContent()) { doc.addPage(); y = topContent(); drawHeader(); }
        if (rowIndex % 2 === 1) doc.save().fillColor('#F8FAFC').rect(left, y, available, rowHeight).fill().restore();
        let x = left;
        tableValues.forEach((value, index) => {
          drawRichText(doc, value, x + 5, y + 4, widths[index] - 10, rowHeight - 8, 7.2, '#1E293B');
          x += widths[index];
        });
        doc.save().strokeColor('#CBD5E1').moveTo(left, y + rowHeight).lineTo(left + available, y + rowHeight).stroke().restore();
        y += rowHeight;
      });
    }

    if (appendix.length) {
      doc.addPage();
      y = topContent();
      drawRichText(doc, 'Extended text details', left, y, pageWidth(), 20, 13, '#10243C');
      y += 28;
      for (const item of appendix) {
        const heading = `Record ${item.record} · ${item.label}`;
        const bodyHeight = measureRichText(doc, item.value, pageWidth(), 8.5) + 8;
        const headingHeight = measureRichText(doc, heading, pageWidth(), 9.5) + 8;
        if (y + headingHeight + bodyHeight > bottomContent()) { doc.addPage(); y = topContent(); }
        drawRichText(doc, heading, left, y, pageWidth(), headingHeight, 9.5, '#16415E');
        y += headingHeight;
        drawRichText(doc, item.value, left, y, pageWidth(), bodyHeight, 8.5, '#1E293B');
        y += bodyHeight + 8;
      }
    }

    if (verification) {
      doc.addPage({ size: 'A4', layout: 'portrait', margin: 42 });
      drawRichText(doc, 'DOCUMENT AUTHENTICITY', left, 48, pageWidth(), 16, 8, '#0E7490');
      drawRichText(doc, 'Official report verification', left, 72, pageWidth(), 26, 18, '#10243C');
      drawRichText(doc, 'This page contains the report reference, machine-readable verification code, and report-data fingerprint.', left, 104, pageWidth(), 28, 9, '#475569');
      drawRichText(doc, `Report ID: ${verification.id}`, left, 146, pageWidth() - 118, 18, 10, '#10243C');
      drawRichText(doc, `Issued: ${report.generatedAt}`, left, 168, pageWidth() - 118, 18, 8, '#334155');
      drawRichText(doc, `SHA-256 data fingerprint: ${verification.reportHash}`, left, 192, pageWidth() - 118, 38, 7.5, '#334155');
      drawReportQr(doc, verification.verificationUrl, left + pageWidth() - 100, 140, 94);
      drawRichText(doc, 'SCAN TO VERIFY', left + pageWidth() - 105, 238, 104, 14, 7, '#0E7490', 'center');
      drawRichText(doc, 'Barcode reference', left, 252, pageWidth(), 16, 8, '#475569');
      drawReportBarcode(doc, verification.id, left, 274, pageWidth() - 8, 42);
      drawRichText(doc, verification.id, left, 320, pageWidth(), 16, 9, '#10243C');
      drawRichText(doc, 'Verification confirms that SKILLBRIDGE ET issued a report record with this ID and data fingerprint. Compare the printed report content and fingerprint; a valid code alone does not certify that a modified copy is unchanged.', left, 354, pageWidth(), 54, 8, '#475569');
      drawRichText(doc, verification.verificationUrl, left, 420, pageWidth(), 30, 7, '#0E7490');
    }

    const pages = doc.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index);
      doc.font('Latin').fontSize(7).fillColor('#64748B');
      doc.text('SKILLBRIDGE ET · Administrative report', left, doc.page.height - 68, { width: pageWidth() / 2, align: 'left' });
      doc.text(`Page ${index + 1} of ${pages.count}`, left + pageWidth() / 2, doc.page.height - 68, { width: pageWidth() / 2, align: 'right' });
    }
    doc.end();
  });
}

export async function createAdminReportFile(report: AdminReportResult, format: AdminReportFormat, verification?: IssuedReportIdentity): Promise<AdminReportFile> {
  const extension = format === 'xlsx' ? 'xlsx' : format;
  const contentType = format === 'pdf'
    ? 'application/pdf'
    : format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'text/csv; charset=utf-8';
  const buffer = format === 'pdf' ? await createPdf(report, verification) : format === 'xlsx' ? await createXlsx(report) : createCsv(report);
  return { buffer, contentType, extension, filename: createFilename(report, extension) };
}