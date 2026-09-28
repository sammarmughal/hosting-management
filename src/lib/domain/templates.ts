// Message templates (docs/08 §1). A template may hold three sections,
// [[before]] / [[today]] / [[after]], picked by days left.

export type TemplateMode = "html" | "text"
export type TemplateSection = "before" | "today" | "after"
export type TemplateVars = Record<string, string | number | null | undefined>

const MARKER_RE = /\[\[(before|today|after)\]\]/g

export function sectionFor(days: number): TemplateSection {
  return days > 0 ? "before" : days === 0 ? "today" : "after"
}

/**
 * Returns the section for `days`. A template without markers is used as-is.
 * If the wanted section is missing, the first section present is used.
 */
export function pickSection(template: string, days: number): string {
  const matches = [...template.matchAll(MARKER_RE)]
  if (matches.length === 0) return template

  const sections = new Map<TemplateSection, string>()
  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length
    const end = matches[i + 1]?.index ?? template.length
    sections.set(m[1] as TemplateSection, template.slice(start, end).trim())
  })

  return sections.get(sectionFor(days)) ?? sections.values().next().value ?? ""
}

/** 7 → "in 7 days", 1 → "in 1 day", 0 → "today", −3 → "3 days ago". */
export function daysText(days: number): string {
  if (days === 0) return "today"
  const n = Math.abs(days)
  const unit = n === 1 ? "day" : "days"
  return days > 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export interface RenderOptions {
  mode: TemplateMode
  /** Keys inserted without escaping in HTML mode (code-built HTML only). */
  raw?: readonly string[]
}

/**
 * Replaces {placeholders}. Unknown placeholders are left unchanged. In HTML
 * mode every value is escaped, except keys listed in `raw`.
 */
export function renderTemplate(
  template: string,
  vars: TemplateVars,
  { mode, raw = ["summary_table"] }: RenderOptions
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    if (!Object.hasOwn(vars, key)) return match
    const value = vars[key]
    const text = value === null || value === undefined ? "" : String(value)
    return mode === "html" && !raw.includes(key) ? escapeHtml(text) : text
  })
}

/** Picks the section for `days`, then renders it. */
export function renderForDays(
  template: string,
  days: number,
  vars: TemplateVars,
  options: RenderOptions
): string {
  return renderTemplate(pickSection(template, days), vars, options)
}
