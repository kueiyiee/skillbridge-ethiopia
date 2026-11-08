import { stringify } from 'csv-stringify/sync';

export function safeEmployerSpreadsheetCell(value: unknown): unknown {
  if (typeof value === 'string' && /^[\s]*[=+\-@]/u.test(value)) return `'${value}`;
  if (value instanceof Date) return value.toISOString();
  return value ?? '';
}

export function createEmployerReportCsv(
  type: string,
  generatedAt: string,
  period: { startDate?: string; endDate?: string },
  columns: Array<{ key: string; label: string }>,
  rows: Array<Record<string, unknown>>,
): string {
  const csvColumns = [
    { key: 'report', header: 'Report' },
    { key: 'generatedAt', header: 'Generated at (UTC)' },
    { key: 'startDate', header: 'Start date' },
    { key: 'endDate', header: 'End date' },
    ...columns.map(({ key, label }) => ({ key, header: label })),
  ];
  const reportRows = rows.length
    ? rows.map((row) => ({
      report: type,
      generatedAt,
      startDate: period.startDate ?? '',
      endDate: period.endDate ?? '',
      ...Object.fromEntries(columns.map((column) => [column.key, row[column.key] ?? ''])),
    }))
    : [{ report: type, generatedAt, startDate: period.startDate ?? '', endDate: period.endDate ?? '' }];
  const safeRows = reportRows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, safeEmployerSpreadsheetCell(value)]),
  ));
  return stringify(safeRows, { header: true, columns: csvColumns, bom: true, record_delimiter: 'windows' });
}
