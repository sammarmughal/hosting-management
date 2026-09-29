// CSV export helpers (docs/05 §6): quote when needed and neutralise formulas.

/** Cells starting with these are prefixed with ' so spreadsheets don't run them. */
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ""
  let s = String(value)
  if (FORMULA_START.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Header row + rows, CRLF line endings (what Excel expects). */
export function toCsv<T>(
  rows: readonly T[],
  columns: readonly {
    header: string
    value: (row: T) => string | number | boolean | null | undefined
  }[]
): string {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(",")),
  ]
  return lines.join("\r\n") + "\r\n"
}
