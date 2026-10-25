// Zod schemas shared by forms (client-side) and Server Actions (server-side),
// so one schema validates both (docs/02 §1). Pure: `today` is passed in.
import { z } from "zod"

import { currencyDecimals, currencySchema } from "@/lib/domain/currency"
import { addDays, isISODate, type ISODate } from "@/lib/domain/dates"
import {
  isValidDomain,
  looksLikeDomain,
  normaliseIdentifier,
} from "@/lib/domain/hostname"
import { toUnits } from "@/lib/domain/money"
import { normalisePhone } from "@/lib/domain/whatsapp"

export const PAYMENT_METHODS = [
  "Cash",
  "Bank transfer",
  "JazzCash",
  "Easypaisa",
  "Other",
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Form labels ⇄ the payments.method enum values (docs/03). */
export const PAYMENT_METHOD_KEYS = {
  Cash: "cash",
  "Bank transfer": "bank_transfer",
  JazzCash: "jazzcash",
  Easypaisa: "easypaisa",
  Other: "other",
} as const satisfies Record<PaymentMethod, string>

export type PaymentMethodKey = (typeof PAYMENT_METHOD_KEYS)[PaymentMethod]

export function paymentMethodLabel(key: string): PaymentMethod {
  const found = (Object.keys(PAYMENT_METHOD_KEYS) as PaymentMethod[]).find(
    (label) => PAYMENT_METHOD_KEYS[label] === key
  )
  return found ?? "Other"
}

/** Up to 10 digits before the point and 3 after (DECIMAL(15,3) leaves room for tax). */
const AMOUNT_RE = /^\d{1,10}(\.\d{1,3})?$/

/**
 * Null when `amount` fits the currency's minor unit, else the message:
 * "PKR amounts can’t have decimals", "USD amounts have at most 2 decimals".
 */
export function amountDecimalsIssue(amount: string, currency: string): string | null {
  const used = (/\.(\d+)$/.exec(amount)?.[1] ?? "").replace(/0+$/, "").length
  const allowed = currencyDecimals(currency)
  if (used <= allowed) return null
  return allowed === 0
    ? `${currency} amounts can’t have decimals`
    : `${currency} amounts have at most ${allowed} decimals`
}

/** "6,500" or "6500.50" → "6500.50"-style string. Must be > 0. */
export const paymentAmount = z
  .string()
  .trim()
  .transform((s) => s.replace(/,/g, ""))
  .pipe(
    z
      .string()
      .min(1, "Enter the amount paid")
      .regex(AMOUNT_RE, "Enter an amount like 6500 or 6500.50")
      // Zod keeps running checks after a failure, so guard before toUnits().
      .refine((s) => !AMOUNT_RE.test(s) || toUnits(s) > 0n, "Amount must be more than 0")
  )

/**
 * Renew / Mark paid (docs/04 §6, docs/06 §4.8). `currency` is the subscription's:
 * the amount may not have more decimals than it allows.
 */
export function renewSchema(today: ISODate, currency?: string) {
  return z
    .object({
      subscriptionId: z.number().int().positive(),
      amount: currency
        ? paymentAmount.superRefine((s, ctx) => {
            const issue = AMOUNT_RE.test(s) ? amountDecimalsIssue(s, currency) : null
            if (issue) ctx.addIssue({ code: "custom", message: issue })
          })
        : paymentAmount,
      paidOn: z
        .string()
        .refine(isISODate, "Enter a valid date")
        .refine((d) => d <= addDays(today, 1), "Paid on can't be in the future"),
      method: z.enum(PAYMENT_METHODS, { message: "Choose how it was paid" }),
      reference: z.string().trim().max(100, "Keep it under 100 characters").optional(),
      notes: z.string().trim().max(1000, "Keep it under 1,000 characters").optional(),
      extendFrom: z.enum(["renewal", "today"]),
    })
    .strict()
}

export type RenewInput = z.input<ReturnType<typeof renewSchema>>
export type RenewData = z.output<ReturnType<typeof renewSchema>>

/* Clients, companies, the catalog and subscriptions (docs/04 §8, docs/14) */

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max.toLocaleString("en-US")} characters`)

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .max(190, "Keep it under 190 characters")
  .refine(
    (v) => v === "" || z.email().safeParse(v).success,
    "Enter a valid email address"
  )

const phoneField = z
  .string()
  .trim()
  .refine(
    (v) => v === "" || normalisePhone(v) !== null,
    "Enter a valid number, like 0300 1234567"
  )

/** Form values are strings ("" = empty); the parsed output uses null for empty. */
export const clientSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter the client's name")
      .max(150, "Keep it under 150 characters"),
    email: emailField,
    phone: phoneField,
    /** Billing address; printed under the client on invoices (Bill to). */
    address: text(300).optional(),
    /** Default currency: new subscriptions (and so their invoices and payments) start in it. */
    currency: currencySchema,
    notes: text(2000),
  })
  .strict()
  .superRefine((c, ctx) => {
    if (!c.email && !c.phone) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Add an email or a WhatsApp number so reminders can reach them",
      })
    }
  })
  .transform((c) => ({
    name: c.name,
    email: c.email || null,
    phone: c.phone ? normalisePhone(c.phone) : null,
    address: c.address || null,
    currency: c.currency,
    notes: c.notes || null,
  }))

/** Select values arrive as strings; ids are positive integers. */
const requiredId = (message: string) =>
  z
    .union([z.number(), z.string()])
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n > 0, message)

/** "" or null = none. */
const optionalId = (message: string) =>
  z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => (v === null || v === "" ? null : Number(v)))
    .refine((n) => n === null || (Number.isInteger(n) && n > 0), message)

/** A client's company (docs/14 §3): only the name is required. */
export const companySchema = z
  .object({
    clientId: requiredId("Choose the client"),
    name: z
      .string()
      .trim()
      .min(2, "Enter the company name")
      .max(150, "Keep it under 150 characters"),
    email: emailField,
    phone: phoneField,
    address: text(300),
  })
  .strict()
  .transform((c) => ({
    clientId: c.clientId,
    name: c.name,
    email: c.email || null,
    phone: c.phone ? normalisePhone(c.phone) : null,
    address: c.address || null,
  }))

/** Optional money: "" = none. */
const optionalAmount = z
  .string()
  .trim()
  .transform((s) => s.replace(/,/g, ""))
  .pipe(
    z
      .string()
      .refine(
        (s) => s === "" || AMOUNT_RE.test(s),
        "Enter an amount like 6500 or 6500.50"
      )
  )

/** A Service Catalog entry (docs/14 §2). */
export const serviceTypeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter the service name")
      .max(100, "Keep it under 100 characters"),
    defaultPrice: optionalAmount,
    isActive: z.boolean(),
  })
  .strict()
  .transform((t) => ({ ...t, defaultPrice: t.defaultPrice || null }))

const chargeAmount = z
  .string()
  .trim()
  .transform((s) => s.replace(/,/g, ""))
  .pipe(
    z
      .string()
      .min(1, "Enter the renewal charge")
      .regex(AMOUNT_RE, "Enter an amount like 6500 or 6500.50")
  )

/** The domain, or another identifier when it isn't one (docs/14 §1). */
const identifier = z
  .string()
  .transform(normaliseIdentifier)
  .superRefine((s, ctx) => {
    const issue =
      s.length === 0
        ? "Enter the domain or an identifier"
        : looksLikeDomain(s)
          ? isValidDomain(s)
            ? null
            : "Enter a domain like noordental.pk"
          : s.length < 2
            ? "Enter at least 2 characters"
            : s.length > 190
              ? "Keep it under 190 characters"
              : null
    if (issue) ctx.addIssue({ code: "custom", message: issue })
  })

export const subscriptionSchema = z
  .object({
    clientId: requiredId("Choose the client"),
    companyId: optionalId("Choose a company"),
    serviceTypeId: requiredId("Choose the service"),
    domain: identifier,
    planLabel: text(100),
    startDate: z.string().refine(isISODate, "Enter a valid date"),
    renewalDate: z.string().refine(isISODate, "Enter a valid date"),
    chargeAmount,
    /** Starts as the client's currency; can be overridden per subscription. */
    currency: currencySchema,
    remindersEnabled: z.boolean(),
    notes: text(2000),
  })
  .strict()
  .refine(
    (s) =>
      !isISODate(s.startDate) || !isISODate(s.renewalDate) || s.renewalDate > s.startDate,
    { path: ["renewalDate"], message: "Renewal date must be after the start date" }
  )
  .superRefine((s, ctx) => {
    if (!AMOUNT_RE.test(s.chargeAmount)) return
    const issue = amountDecimalsIssue(s.chargeAmount, s.currency)
    if (issue) ctx.addIssue({ code: "custom", path: ["chargeAmount"], message: issue })
  })
  .transform((s) => ({ ...s, planLabel: s.planLabel || null, notes: s.notes || null }))

export type ClientInput = z.input<typeof clientSchema>
export type ClientData = z.output<typeof clientSchema>
export type CompanyInput = z.input<typeof companySchema>
export type CompanyData = z.output<typeof companySchema>
export type ServiceTypeInput = z.input<typeof serviceTypeSchema>
export type ServiceTypeData = z.output<typeof serviceTypeSchema>
export type SubscriptionInput = z.input<typeof subscriptionSchema>
export type SubscriptionData = z.output<typeof subscriptionSchema>
/** Start dates more than a day ahead are allowed but worth a warning (docs/04 §8). */
export function startDateWarning(startDate: string, today: ISODate): string | null {
  return isISODate(startDate) && startDate > addDays(today, 1)
    ? "This start date is in the future. Check it's right."
    : null
}

/** zod issues → { "name": "…" } for RHF setError / action fieldErrors. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}
