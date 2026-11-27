export type CsvCell = string | number | null | undefined;

/**
 * One value for a CSV file. Text that starts with = + - @ is prefixed with a quote, so a customer name like
 * =HYPERLINK(...) cannot run as a formula when the owner opens the file in Excel.
 */
export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The first character is a byte-order mark so Excel reads the file as UTF-8 (Amharic names stay readable). */
export function toCsv(rows: CsvCell[][]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
