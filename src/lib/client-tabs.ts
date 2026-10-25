// The client page's tabs (docs/14 §7). Not in the "use client" tabs module:
// the server page reads this list to validate ?tab=.
export type ClientTab =
  "overview" | "companies" | "subscriptions" | "invoices" | "payments"

export const CLIENT_TABS: readonly ClientTab[] = [
  "overview",
  "companies",
  "subscriptions",
  "invoices",
  "payments",
]
