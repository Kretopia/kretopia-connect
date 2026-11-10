/**
 * One CSV cell, quoted, with spreadsheet formula triggers neutralized: a value
 * starting with = + - @ tab or carriage return is prefixed with an apostrophe
 * so Excel/Sheets treat it as text instead of executing it.
 */
export function csvCell(value: unknown): string {
  let s = (value ?? "").toString();
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Escape text for insertion into an HTML document string. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
