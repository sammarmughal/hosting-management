// CSV export columns (docs/14 §9). Clients, companies and subscriptions use
// the import headers first, so an export imports back unchanged; extra
// columns come last and are ignored on import.
import { plainAmount } from "@/lib/domain/money"
import type { ClientExportRow, CompanyExportRow } from "@/lib/server/queries"
import type { PaymentRow, SubscriptionRow } from "@/types/view"

export type Column<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
}

/** Excel opens UTF-8 (Urdu names) correctly with a byte order mark. */
export const CSV_BOM = "﻿"

export const CLIENT_COLUMNS: Column<ClientExportRow>[] = [
  { header: "name", value: (c) => c.name },
  { header: "email", value: (c) => c.email },
  // Digits only: a leading "+" would get the formula-guard ' prefix.
  { header: "phone", value: (c) => c.phone },
  { header: "address", value: (c) => c.address },
  { header: "currency", value: (c) => c.currency },
  { header: "notes", value: (c) => c.notes },
  { header: "companies", value: (c) => c.companies },
  { header: "subscriptions", value: (c) => c.subscriptions },
  { header: "created_on", value: (c) => c.createdOn },
]

export const COMPANY_COLUMNS: Column<CompanyExportRow>[] = [
  { header: "client_name", value: (c) => c.clientName },
  { header: "client_email", value: (c) => c.clientEmail },
  { header: "client_phone", value: (c) => c.clientPhone },
  { header: "company_name", value: (c) => c.name },
  { header: "email", value: (c) => c.email },
  { header: "phone", value: (c) => c.phone },
  { header: "address", value: (c) => c.address },
]

export const SUBSCRIPTION_COLUMNS: Column<SubscriptionRow>[] = [
  { header: "client_name", value: (s) => s.clientName },
  { header: "client_email", value: (s) => s.email },
  { header: "client_phone", value: (s) => s.phone },
  { header: "company_name", value: (s) => s.company },
  { header: "service_type", value: (s) => s.serviceName },
  { header: "domain", value: (s) => s.domain },
  { header: "plan_label", value: (s) => s.planLabel },
  { header: "start_date", value: (s) => s.startDate },
  { header: "renewal_date", value: (s) => s.renewalDate },
  { header: "charge_amount", value: (s) => plainAmount(s.chargeAmount, s.currency) },
  { header: "currency", value: (s) => s.currency },
  { header: "reminders", value: (s) => (s.remindersEnabled ? "yes" : "no") },
  { header: "notes", value: (s) => s.notes },
  { header: "status", value: (s) => s.status },
  { header: "days_left", value: (s) => s.daysLeft },
]

export const PAYMENT_COLUMNS: Column<PaymentRow>[] = [
  { header: "paid_on", value: (p) => p.paidOn },
  { header: "client_name", value: (p) => p.clientName },
  { header: "company", value: (p) => p.company },
  { header: "service_type", value: (p) => p.serviceName },
  { header: "domain", value: (p) => p.domain },
  { header: "amount", value: (p) => plainAmount(p.amount, p.currency) },
  { header: "currency", value: (p) => p.currency },
  { header: "method", value: (p) => p.method },
  { header: "reference", value: (p) => p.reference },
  { header: "period_from", value: (p) => p.periodFrom },
  { header: "period_to", value: (p) => p.periodTo },
]
