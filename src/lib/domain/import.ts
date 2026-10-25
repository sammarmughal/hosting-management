// CSV import (docs/04 §9, docs/14 §9): clients, companies and subscriptions,
// each from its own file. Pure: the browser runs it for the preview, and the
// server runs it again with fresh lookups before anything is written.
import { DEFAULT_ENABLED_CURRENCIES, FALLBACK_CURRENCY } from "@/lib/domain/currency"
import { nextRenewal } from "@/lib/domain/cycles"
import { isISODate, todayPK, type ISODate } from "@/lib/domain/dates"
import { normaliseIdentifier } from "@/lib/domain/hostname"
import { sameServiceName } from "@/lib/domain/service-types"
import {
  clientSchema,
  companySchema,
  subscriptionSchema,
  type ClientData,
  type CompanyData,
  type SubscriptionData,
} from "@/lib/domain/validation"
import { normalisePhone } from "@/lib/domain/whatsapp"

export type ImportKind = "clients" | "companies" | "subscriptions"

/** The columns of each file, in template order (exports use the same). */
export const IMPORT_HEADERS: Record<ImportKind, readonly string[]> = {
  clients: ["name", "email", "phone", "address", "currency", "notes"],
  companies: [
    "client_name",
    "client_email",
    "client_phone",
    "company_name",
    "email",
    "phone",
    "address",
  ],
  subscriptions: [
    "client_name",
    "client_email",
    "client_phone",
    "company_name",
    "service_type",
    "domain",
    "plan_label",
    "start_date",
    "renewal_date",
    "charge_amount",
    "currency",
    "reminders",
    "notes",
  ],
}

/** Columns a file must have; the rest may be missing or blank. */
export const REQUIRED_HEADERS: Record<ImportKind, readonly string[]> = {
  clients: ["name"],
  companies: ["client_name", "company_name"],
  subscriptions: ["client_name", "service_type", "domain", "start_date", "charge_amount"],
}

export const IMPORT_LABEL: Record<ImportKind, string> = {
  clients: "Clients",
  companies: "Companies",
  subscriptions: "Subscriptions",
}

export type ImportRow = Record<string, string>

export interface ImportCurrencies {
  /** The app default: used when a client's currency is blank. */
  default: string
  enabled: readonly string[]
}

const DEFAULT_CURRENCIES: ImportCurrencies = {
  default: FALLBACK_CURRENCY,
  enabled: DEFAULT_ENABLED_CURRENCIES,
}

/** What the database already holds, for matching rows (docs/14 §9). */
export interface ImportContext {
  today: ISODate
  currencies: ImportCurrencies
  clients: readonly {
    id: number
    name: string
    email: string | null
    phone: string | null
    currency: string
  }[]
  companies: readonly { id: number; clientId: number; name: string }[]
  serviceTypes: readonly { id: number; name: string; isActive: boolean }[]
  /** Active subscriptions (cancelled ones never block or get updated). */
  subscriptions: readonly { id: number; serviceTypeId: number; domain: string }[]
}

export const emptyImportContext = (today = todayPK()): ImportContext => ({
  today,
  currencies: DEFAULT_CURRENCIES,
  clients: [],
  companies: [],
  serviceTypes: [],
  subscriptions: [],
})

export interface PreviewRow<D> {
  /** The spreadsheet row number (the header is row 1). */
  row: number
  status: "valid" | "warning" | "error"
  message: string
  /** Three short texts for the preview table (see PREVIEW_COLUMNS). */
  cells: [string, string, string]
  /** Validated data, or null on error. */
  data: D | null
  /** The record this row would update, or null for a new one. */
  existingId: number | null
}

export const PREVIEW_COLUMNS: Record<ImportKind, [string, string, string]> = {
  clients: ["Client", "Email or phone", "Currency"],
  companies: ["Company", "Client", "Email or phone"],
  subscriptions: ["Domain / identifier", "Client · company", "Renewal"],
}

export type ClientPreview = PreviewRow<ClientData>
export type CompanyPreview = PreviewRow<CompanyData>
export type SubscriptionPreview = PreviewRow<SubscriptionData>

/** DD/MM/YYYY → YYYY-MM-DD; anything else unchanged. */
function date(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value
}

const getter = (row: ImportRow) => (key: string) => (row[key] ?? "").trim()
const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()

/**
 * The client a row means: same name (ignoring case) plus the same email or
 * phone (docs/04 §9). Null when there's no such client.
 */
export function matchClient(
  clients: ImportContext["clients"],
  name: string,
  email: string,
  phone: string
) {
  const digits = phone ? normalisePhone(phone) : null
  return (
    clients.find(
      (c) =>
        lower(c.name) === lower(name) &&
        ((!!email && lower(c.email) === lower(email)) || (!!digits && c.phone === digits))
    ) ?? null
  )
}

function result<D>(
  row: number,
  cells: PreviewRow<D>["cells"],
  errors: string[],
  warnings: string[],
  data: D | null,
  existingId: number | null
): PreviewRow<D> {
  const error = errors.length > 0
  return {
    row,
    cells,
    status: error ? "error" : warnings.length ? "warning" : "valid",
    message: error ? errors.join("; ") : warnings.join("; ") || "Ready to import",
    data: error ? null : data,
    existingId: error ? null : existingId,
  }
}

const issues = (e: { issues: { message: string }[] }) => e.issues.map((i) => i.message)
const UPDATE_NOTE = "skipped unless updates are enabled"

/* Clients --------------------------------------------------------------- */

export function previewClients(rows: ImportRow[], ctx: ImportContext): ClientPreview[] {
  const seen = new Set<number | string>()
  return rows.map((raw, index) => {
    const get = getter(raw)
    const input = {
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
      address: get("address"),
      currency: get("currency").toUpperCase() || ctx.currencies.default,
      notes: get("notes"),
    }
    const errors: string[] = []
    const warnings: string[] = []
    const parsed = clientSchema.safeParse(input)
    if (!parsed.success) errors.push(...issues(parsed.error))
    else if (!ctx.currencies.enabled.includes(parsed.data.currency))
      errors.push(`${parsed.data.currency} isn’t turned on in Settings`)
    const existing = matchClient(ctx.clients, input.name, input.email, input.phone)
    const key =
      existing?.id ?? `${lower(input.name)}|${lower(input.email)}|${input.phone}`
    if (seen.has(key)) errors.push("The same client is in this file twice")
    seen.add(key)
    if (existing) warnings.push(`Client already exists; ${UPDATE_NOTE}`)
    return result(
      index + 2,
      [input.name, input.email || input.phone, input.currency],
      errors,
      warnings,
      parsed.success ? parsed.data : null,
      existing?.id ?? null
    )
  })
}

/* Companies ------------------------------------------------------------- */

const NO_CLIENT = "No client with this name and email or phone. Import clients first."

export function previewCompanies(
  rows: ImportRow[],
  ctx: ImportContext
): CompanyPreview[] {
  const seen = new Set<string>()
  return rows.map((raw, index) => {
    const get = getter(raw)
    const client = matchClient(
      ctx.clients,
      get("client_name"),
      get("client_email"),
      get("client_phone")
    )
    const errors: string[] = []
    const warnings: string[] = []
    if (!client) errors.push(NO_CLIENT)
    const parsed = companySchema.safeParse({
      clientId: client?.id ?? 0,
      name: get("company_name"),
      email: get("email"),
      phone: get("phone"),
      address: get("address"),
    })
    if (!parsed.success)
      errors.push(...issues(parsed.error).filter((m) => m !== "Choose the client"))
    const existing = client
      ? ctx.companies.find(
          (c) => c.clientId === client.id && lower(c.name) === lower(get("company_name"))
        )
      : undefined
    const key = `${client?.id ?? lower(get("client_name"))}|${lower(get("company_name"))}`
    if (seen.has(key)) errors.push("The same company is in this file twice")
    seen.add(key)
    if (existing) warnings.push(`Company already exists; ${UPDATE_NOTE}`)
    return result(
      index + 2,
      [get("company_name"), get("client_name"), get("email") || get("phone")],
      errors,
      warnings,
      parsed.success ? parsed.data : null,
      existing?.id ?? null
    )
  })
}

/* Subscriptions ---------------------------------------------------------- */

/** yes/no/blank (blank = yes). */
function reminders(value: string): boolean | null {
  const v = value.toLowerCase()
  if (v === "" || v === "yes" || v === "y" || v === "true" || v === "1") return true
  if (v === "no" || v === "n" || v === "false" || v === "0") return false
  return null
}

export function previewSubscriptions(
  rows: ImportRow[],
  ctx: ImportContext
): SubscriptionPreview[] {
  const seen = new Set<string>()
  return rows.map((raw, index) => {
    const get = getter(raw)
    const errors: string[] = []
    const warnings: string[] = []
    const client = matchClient(
      ctx.clients,
      get("client_name"),
      get("client_email"),
      get("client_phone")
    )
    if (!client) errors.push(NO_CLIENT)

    const companyName = get("company_name")
    const company =
      client && companyName
        ? ctx.companies.find(
            (c) => c.clientId === client.id && lower(c.name) === lower(companyName)
          )
        : undefined
    if (client && companyName && !company)
      errors.push(
        `${companyName} isn’t a company of this client. Import companies first.`
      )

    const typeName = get("service_type")
    const type = ctx.serviceTypes.find((t) => sameServiceName(t.name, typeName))
    if (!type)
      errors.push(typeName ? `Unknown service: ${typeName}` : "Enter the service type")
    else if (!type.isActive)
      errors.push(`${type.name} is inactive in the Service Catalog`)

    const remind = reminders(get("reminders"))
    if (remind === null) errors.push("Reminders must be yes or no")

    const startDate = date(get("start_date"))
    const renewalDate =
      date(get("renewal_date")) || (isISODate(startDate) ? nextRenewal(startDate) : "")
    const domain = normaliseIdentifier(get("domain"))
    const parsed = subscriptionSchema.safeParse({
      clientId: client?.id ?? 0,
      companyId: company?.id ?? null,
      serviceTypeId: type?.id ?? 0,
      domain,
      planLabel: get("plan_label"),
      startDate,
      renewalDate,
      chargeAmount: get("charge_amount"),
      // Blank = the client's own currency (docs/13 §6).
      currency:
        get("currency").toUpperCase() || client?.currency || ctx.currencies.default,
      remindersEnabled: remind ?? true,
      notes: get("notes"),
    })
    if (!parsed.success)
      errors.push(
        ...issues(parsed.error).filter(
          (m) => m !== "Choose the client" && m !== "Choose the service"
        )
      )
    else if (!ctx.currencies.enabled.includes(parsed.data.currency))
      errors.push(`${parsed.data.currency} isn’t turned on in Settings`)

    const key = `${type?.id ?? lower(typeName)}|${lower(domain)}`
    if (seen.has(key)) errors.push("The same subscription is in this file twice")
    seen.add(key)
    const existing = type
      ? ctx.subscriptions.find(
          (s) => s.serviceTypeId === type.id && lower(s.domain) === lower(domain)
        )
      : undefined
    if (existing) warnings.push(`Subscription already exists; ${UPDATE_NOTE}`)
    if (isISODate(startDate) && startDate > ctx.today)
      warnings.push("Start date is in the future")
    if (!get("renewal_date") && isISODate(startDate))
      warnings.push("Renewal date set to start + 1 year")

    const who = [get("client_name"), companyName].filter(Boolean).join(" · ")
    return result(
      index + 2,
      [domain, who, isISODate(renewalDate) ? renewalDate : ""],
      errors,
      warnings,
      parsed.success ? parsed.data : null,
      existing?.id ?? null
    )
  })
}

export function previewImport(kind: ImportKind, rows: ImportRow[], ctx: ImportContext) {
  return kind === "clients"
    ? previewClients(rows, ctx)
    : kind === "companies"
      ? previewCompanies(rows, ctx)
      : previewSubscriptions(rows, ctx)
}
