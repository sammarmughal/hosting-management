// Zod schemas shared by forms (client-side) and Server Actions (server-side),
// so one schema validates both (docs/02 §1). Pure: `today` is passed in.
import { z } from "zod"

import { addDays, isISODate, type ISODate } from "@/lib/domain/dates"
import { isValidDomain, normaliseDomain } from "@/lib/domain/hostname"
import { toCents } from "@/lib/domain/money"
import { normalisePhone } from "@/lib/domain/whatsapp"

export const PAYMENT_METHODS = [
  "Cash",
  "Bank transfer",
  "JazzCash",
  "Easypaisa",
  "Other",
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

const AMOUNT_RE = /^\d{1,8}(\.\d{1,2})?$/

/** "6,500" or "6500.50" → "6500.50"-style string. Must be > 0 and ≤ 99,999,999.99. */
export const paymentAmount = z
  .string()
  .trim()
  .transform((s) => s.replace(/,/g, ""))
  .pipe(
    z
      .string()
      .min(1, "Enter the amount paid")
      .regex(AMOUNT_RE, "Enter an amount like 6500 or 6500.50")
      // Zod keeps running checks after a failure, so guard before toCents().
      .refine((s) => !AMOUNT_RE.test(s) || toCents(s) > 0n, "Amount must be more than 0")
  )

/** Renew / Mark paid (docs/04 §6, docs/06 §4.8). */
export function renewSchema(today: ISODate) {
  return z
    .object({
      serviceId: z.number().int().positive(),
      amount: paymentAmount,
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

/* Clients and services (docs/04 §8) --------------------------------- */

export const CURRENCIES = ["PKR", "USD", "AED", "GBP", "EUR"] as const
export type Currency = (typeof CURRENCIES)[number]

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max.toLocaleString("en-US")} characters`)

/** Form values are strings ("" = empty); the parsed output uses null for empty. */
export const clientSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Enter the client's name")
      .max(150, "Keep it under 150 characters"),
    company: text(150),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(190, "Keep it under 190 characters")
      .refine(
        (v) => v === "" || z.email().safeParse(v).success,
        "Enter a valid email address"
      ),
    phone: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || normalisePhone(v) !== null,
        "Enter a valid number, like 0300 1234567"
      ),
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
    company: c.company || null,
    email: c.email || null,
    phone: c.phone ? normalisePhone(c.phone) : null,
    notes: c.notes || null,
  }))

const chargeAmount = z
  .string()
  .trim()
  .transform((s) => s.replace(/,/g, ""))
  .pipe(
    z
      .string()
      .min(1, "Enter the yearly charge")
      .regex(AMOUNT_RE, "Enter an amount like 6500 or 6500.50")
  )

export const serviceSchema = z
  .object({
    domain: z
      .string()
      .transform(normaliseDomain)
      .pipe(
        z
          .string()
          .min(1, "Enter the domain")
          .refine(isValidDomain, "Enter a domain like noordental.pk")
      ),
    planLabel: text(100),
    startDate: z.string().refine(isISODate, "Enter a valid date"),
    renewalDate: z.string().refine(isISODate, "Enter a valid date"),
    chargeAmount,
    currency: z.enum(CURRENCIES, { message: "Choose a currency" }),
    remindersEnabled: z.boolean(),
    notes: text(2000),
  })
  .strict()
  .refine(
    (s) =>
      !isISODate(s.startDate) || !isISODate(s.renewalDate) || s.renewalDate > s.startDate,
    { path: ["renewalDate"], message: "Renewal date must be after the start date" }
  )
  .transform((s) => ({ ...s, planLabel: s.planLabel || null, notes: s.notes || null }))

export const newClientSchema = z
  .object({ client: clientSchema, service: serviceSchema })
  .strict()

export type ClientInput = z.input<typeof clientSchema>
export type ClientData = z.output<typeof clientSchema>
export type ServiceInput = z.input<typeof serviceSchema>
export type ServiceData = z.output<typeof serviceSchema>
export type NewClientInput = z.input<typeof newClientSchema>
export type NewClientData = z.output<typeof newClientSchema>

/** Start dates more than a day ahead are allowed but worth a warning (docs/04 §8). */
export function startDateWarning(startDate: string, today: ISODate): string | null {
  return isISODate(startDate) && startDate > addDays(today, 1)
    ? "This start date is in the future. Check it's right."
    : null
}

/** zod issues → { "client.name": "…" } for RHF setError / action fieldErrors. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}
