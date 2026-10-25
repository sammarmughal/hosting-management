// Companies (docs/14 §3). Pure.

export interface CompanyDeleteCounts {
  subscriptions: number
  invoices: number
  payments: number
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * The delete confirmation's body: "This deletes 2 subscriptions, 3 invoices,
 * 1 payment and their reminders. This can't be undone."
 */
export function companyDeleteText(c: CompanyDeleteCounts): string {
  if (c.subscriptions === 0) return "This deletes the company. This can't be undone."
  const parts = [plural(c.subscriptions, "subscription")]
  if (c.invoices) parts.push(plural(c.invoices, "invoice"))
  if (c.payments) parts.push(plural(c.payments, "payment"))
  return `This deletes ${parts.join(", ")} and their reminders. This can't be undone.`
}

/** " (Noor Dental Clinic)" after a domain in messages, or "" (docs/14 §6). */
export const companyLine = (company?: string | null) => (company ? ` (${company})` : "")

/** "Noor Dental Clinic — Dr Noor", for company filters and pickers (docs/14 §8). */
export const companyOptionLabel = (company: string, client: string) =>
  `${company} — ${client}`
