// The Service Catalog (docs/14 §2). Pure.

/** What the migration inserts (and the seed restores in development). */
export const DEFAULT_SERVICE_TYPES = [
  "Domain Registration",
  "Web Hosting",
  "Domain and Hosting",
  "Website Maintenance",
  "AMC",
] as const

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** A type used by any subscription can only be deactivated. */
export const canDeleteServiceType = (usedBy: number) => usedBy === 0

/** The disabled Delete button's tooltip, and the server's refusal; null when it can go. */
export function serviceTypeDeleteBlock(usedBy: number): string | null {
  return canDeleteServiceType(usedBy)
    ? null
    : `Used by ${plural(usedBy, "subscription")}, so it can't be deleted. Deactivate it to hide it from new subscriptions.`
}

/** Names are unique ignoring letter case and surrounding spaces. */
export const sameServiceName = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase()
