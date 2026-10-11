import { addOneYear, isISODate, todayPK } from "@/lib/domain/dates"
import { normaliseDomain } from "@/lib/domain/hostname"
import {
  CURRENCIES,
  newClientSchema,
  type Currency,
  type NewClientInput,
} from "@/lib/domain/validation"

export const IMPORT_HEADERS = [
  "client_name",
  "company",
  "email",
  "phone",
  "address",
  "domain",
  "plan_label",
  "start_date",
  "renewal_date",
  "charge_amount",
  "currency",
  "notes",
]
export type ImportRow = Record<string, string>
export interface PreviewRow {
  row: number
  input: NewClientInput
  status: "valid" | "warning" | "error"
  message: string
  existing: boolean
}
function date(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}
export interface ImportCurrencies {
  /** Used when the currency column is blank. */
  default: Currency
  enabled: readonly Currency[]
}
const ALL_CURRENCIES: ImportCurrencies = { default: "PKR", enabled: CURRENCIES }

export function previewImport(
  rows: ImportRow[],
  existingDomains: string[],
  today = todayPK(),
  currencies: ImportCurrencies = ALL_CURRENCIES
): PreviewRow[] {
  const existing = new Set(existingDomains.map(normaliseDomain))
  const seen = new Set<string>()
  return rows.map((row, index) => {
    const get = (key: string) => (row[key] ?? "").trim()
    const startDate = date(get("start_date"))
    const renewalDate =
      date(get("renewal_date")) || (isISODate(startDate) ? addOneYear(startDate) : "")
    const domain = normaliseDomain(get("domain"))
    const input = {
      client: {
        name: get("client_name"),
        company: get("company"),
        email: get("email"),
        phone: get("phone"),
        address: get("address"),
        notes: get("notes"),
      },
      service: {
        domain,
        planLabel: get("plan_label"),
        startDate,
        renewalDate,
        chargeAmount: get("charge_amount"),
        currency: get("currency").toUpperCase() || currencies.default,
        remindersEnabled: true,
        notes: "",
      },
    } as NewClientInput
    const parsed = newClientSchema.safeParse(input)
    const currencyOff =
      parsed.success && !currencies.enabled.includes(parsed.data.service.currency)
    const duplicate = seen.has(domain)
    seen.add(domain)
    const messages = []
    if (existing.has(domain))
      messages.push("Domain already exists; skipped unless updates are enabled")
    if (isISODate(startDate) && startDate > today)
      messages.push("Start date is in the future")
    if (!get("renewal_date") && isISODate(startDate))
      messages.push("Renewal date set to start + 1 year")
    return {
      row: index + 2,
      input,
      existing: existing.has(domain),
      status:
        !parsed.success || currencyOff || duplicate
          ? "error"
          : messages.length
            ? "warning"
            : "valid",
      message: !parsed.success
        ? parsed.error.issues.map((i) => i.message).join("; ")
        : currencyOff
          ? `${parsed.data.service.currency} isn’t turned on in Settings`
          : duplicate
          ? "Duplicate domain in this file"
          : messages.join("; ") || "Ready to import",
    }
  })
}
