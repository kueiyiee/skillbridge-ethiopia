import PDFDocument from 'pdfkit';
import { resolve } from 'node:path';
import { drawReportBarcode, drawReportQr } from '../report-verification/report-identity.pdf';
import type { IssuedReportIdentity } from '../report-verification/report-verification.service';

const latinFontPath = resolve(process.cwd(), 'node_modules/@fontsource/noto-sans-ethiopic/files/noto-sans-ethiopic-latin-400-normal.woff');
const ethiopicFontPath = resolve(process.cwd(), 'node_modules/@fontsource/noto-sans-ethiopic/files/noto-sans-ethiopic-ethiopic-400-normal.woff');
const ethiopic = /[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]/u;
const segments = (value: string) => value.match(/[\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]+|[^\u1200-\u137f\u1380-\u139f\u2d80-\u2ddf]+/gu) ?? [''];

function drawText(doc: PDFKit.PDFDocument, value: string, x: number, y: number, width: number, size: number, color = '#1E293B', bold = false) {
  let cursorY = y;
  for (const segment of segments(value)) {
    doc.font(ethiopic.test(segment) ? 'Ethiopic' : bold ? 'Helvetica-Bold' : 'Latin').fontSize(size).fillColor(color);
    doc.text(segment, x, cursorY, { width, lineGap: 1 });
    cursorY = doc.y;
  }
  return cursorY;
}

export interface EmployerPdfReport {
  reportId: string;
  verificationUrl: string;
  reportHash: string;
  title: string;
  generatedAt: string;
  startDate?: string;
  endDate?: string;
  employerId: string;
  totalRecords: number;
  truncated: boolean;
  summary: Array<{ label: string; value: number | string }>;
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
}

export function createEmployerReportPdf(report: EmployerPdfReport): Promise<Buffer> {
  return new Promise((resolveBuffer, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: report.columns.length > 5 ? 'landscape' : 'portrait', margin: 40, bufferPages: true, info: { Title: report.title, Author: 'SKILLBRIDGE ET', Subject: 'Digitally verifiable recruitment report' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolveBuffer(Buffer.concat(chunks)));
    doc.registerFont('Latin', latinFontPath);
    doc.registerFont('Ethiopic', ethiopicFontPath);

    const left = 40;
    const width = () => doc.page.width - 80;
    const bottom = () => doc.page.height - 55;
    let y = 42;
    doc.save().fillColor('#0B1727').rect(0, 0, doc.page.width, 92).fill().restore();
    drawText(doc, 'SKILLBRIDGE ET  /  EMPLOYER INTELLIGENCE', left, 28, width(), 8, '#67E8F9', true);
    drawText(doc, report.title, left, 49, width() - 10, 20, '#FFFFFF', true);
    y = 112;
    y = drawText(doc, 'RECRUITMENT PERFORMANCE REPORT', left, y, width(), 8, '#0E7490', true) + 10;
    const metadata = [
      `Organization reference: ${report.employerId}`,
      `Generated: ${report.generatedAt}`,
      `Reporting period: ${report.startDate || 'All available'} — ${report.endDate || 'Present'} (inclusive)`,
      `Matching records: ${report.totalRecords.toLocaleString()}${report.truncated ? ' · Export limit reached; narrow the date range for a complete extract.' : ''}`,
    ];
    for (const line of metadata) y = drawText(doc, line, left, y, width(), 8, '#475569') + 4;
    y += 12;
    y = drawText(doc, 'Executive summary', left, y, width(), 12, '#10243C', true) + 10;
    const metricGap = 10;
    const metricWidth = (width() - metricGap * 2) / 3;
    report.summary.forEach((metric, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const boxY = y + row * 58;
      const x = left + col * (metricWidth + metricGap);
      doc.save().fillColor('#F1F5F9').roundedRect(x, boxY, metricWidth, 48, 6).fill().restore();
      drawText(doc, metric.label, x + 9, boxY + 8, metricWidth - 18, 7, '#64748B');
      drawText(doc, String(metric.value), x + 9, boxY + 23, metricWidth - 18, 13, '#10243C', true);
    });
    y += Math.ceil(report.summary.length / 3) * 58 + 10;
    y = drawText(doc, 'Report details', left, y, width(), 12, '#10243C', true) + 8;

    const colWidths = report.columns.map(() => width() / Math.max(1, report.columns.length));
    const rowHeight = 28;
    const drawHeader = () => {
      doc.save().fillColor('#16415E').rect(left, y, width(), rowHeight).fill().restore();
      report.columns.forEach((column, index) => drawText(doc, column.label, left + colWidths.slice(0, index).reduce((a,b)=>a+b,0) + 5, y + 8, colWidths[index] - 10, 6.5, '#FFFFFF', true));
      y += rowHeight;
    };
    drawHeader();
    report.rows.forEach((row, index) => {
      const cells = report.columns.map((column) => {
        const value = row[column.key];
        if (value === null || value === undefined || value === '') return '—';
        return value instanceof Date ? value.toISOString() : String(value);
      });
      const rowY = y;
      if (rowY + rowHeight > bottom()) { doc.addPage(); y = 42; drawHeader(); }
      if (index % 2 === 1) doc.save().fillColor('#F8FAFC').rect(left, y, width(), rowHeight).fill().restore();
      cells.forEach((value, cellIndex) => drawText(doc, value.length > 58 ? `${value.slice(0, 55)}…` : value, left + colWidths.slice(0, cellIndex).reduce((a,b)=>a+b,0) + 5, y + 7, colWidths[cellIndex] - 10, 6.2));
      doc.save().strokeColor('#E2E8F0').moveTo(left, y + rowHeight).lineTo(left + width(), y + rowHeight).stroke().restore();
      y += rowHeight;
    });
    if (report.rows.length === 0) drawText(doc, 'No records match the selected filters.', left + 6, y + 8, width() - 12, 8, '#64748B');

    doc.addPage({ size: 'A4', layout: 'portrait', margin: 40 });
    y = 48;
    drawText(doc, 'DOCUMENT AUTHENTICITY', left, y, width(), 8, '#0E7490', true);
    y = drawText(doc, 'Official report verification', left, y + 24, width(), 19, '#10243C', true) + 12;
    y = drawText(doc, 'Scan the QR code to retrieve the issued report record. The barcode is a machine-readable report reference.', left, y, width() - 112, 8, '#475569') + 14;
    drawReportQr(doc, report.verificationUrl, left + width() - 100, 105, 94);
    drawText(doc, 'SCAN TO VERIFY', left + width() - 105, 202, 104, 7, '#0E7490', true);
    y = drawText(doc, `Report ID: ${report.reportId}`, left, y, width() - 112, 10, '#10243C', true) + 12;
    y = drawText(doc, `Issuer: verified employer workspace · ${report.employerId}`, left, y, width() - 112, 8, '#475569') + 8;
    y = drawText(doc, `Generated: ${report.generatedAt}`, left, y, width() - 112, 8, '#475569') + 8;
    y = drawText(doc, `SHA-256 report-data fingerprint: ${report.reportHash}`, left, y, width(), 8, '#475569') + 18;
    drawText(doc, 'Barcode reference', left, y, width(), 8, '#475569', true);
    drawReportBarcode(doc, report.reportId, left, y + 18, width() - 8, 42);
    drawText(doc, report.reportId, left, y + 66, width(), 9, '#10243C', true);
    drawText(doc, 'The verification service confirms issuance and the stored report-data fingerprint. Compare the report ID and fingerprint printed here with the verification response. This does not establish that a separately altered copy is unchanged.', left, y + 98, width(), 8, '#64748B');

    const pages = doc.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      doc.switchToPage(index);
      doc.font('Latin').fontSize(7).fillColor('#64748B');
      doc.text('SKILLBRIDGE ET · Employer report', left, doc.page.height - 34, { width: width() / 2 });
      doc.text(`Page ${index + 1} of ${pages.count}`, left + width() / 2, doc.page.height - 34, { width: width() / 2, align: 'right' });
    }
    doc.end();
  });
}
