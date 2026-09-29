// Zod schemas shared by forms (client-side) and Server Actions (server-side),
// so one schema validates both (docs/02 §1). Pure: `today` is passed in.
import { z } from "zod"

import { addDays, isISODate, type ISODate } from "@/lib/domain/dates"
import { toCents } from "@/lib/domain/money"

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
