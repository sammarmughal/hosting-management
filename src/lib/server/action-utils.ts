import "server-only"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fieldErrorsFrom, type ServiceData } from "@/lib/domain/validation"
import { toDbDate } from "@/lib/server/db-dates"
import type { ActionResult } from "@/types/actions"

export const numericId = z.number().int().positive()
/** Reminder and notification ids are BigInt in the DB, strings in the UI. */
export const bigId = z
  .string()
  .regex(/^\d{1,19}$/)
  .transform((s) => BigInt(s))

export function invalid(): ActionResult<never> {
  return { ok: false, error: "Invalid request." }
}

export function checkFields(error: z.ZodError): ActionResult<never> {
  return { ok: false, error: "Check the highlighted fields.", fieldErrors: fieldErrorsFrom(error) }
}

/** Validated service form data → Prisma columns. */
export function serviceData(s: ServiceData) {
  return {
    domain: s.domain,
    planLabel: s.planLabel,
    startDate: toDbDate(s.startDate),
    renewalDate: toDbDate(s.renewalDate),
    chargeAmount: s.chargeAmount,
    currency: s.currency,
    remindersEnabled: s.remindersEnabled,
    notes: s.notes,
  }
}

/** Every page shows services, counts or the bell, so refresh the whole app layout. */
export function refreshApp() {
  revalidatePath("/", "layout")
}
