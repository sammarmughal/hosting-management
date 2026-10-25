import "server-only"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { currencyOptions } from "@/lib/domain/currency"
import { fieldErrorsFrom, type SubscriptionData } from "@/lib/domain/validation"
import { toDbDate } from "@/lib/server/db-dates"
import { getAppSettings } from "@/lib/server/settings"
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
  return {
    ok: false,
    error: "Check the highlighted fields.",
    fieldErrors: fieldErrorsFrom(error),
  }
}

/** Validated subscription form data → Prisma columns. */
export function subscriptionData(s: SubscriptionData) {
  return {
    clientId: s.clientId,
    companyId: s.companyId,
    serviceTypeId: s.serviceTypeId,
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

/** Every page shows subscriptions, counts or the bell, so refresh the whole app layout. */
export function refreshApp() {
  revalidatePath("/", "layout")
}

/** The highlighted-fields answer for problems found on the server. */
export function fieldProblems(fieldErrors: Record<string, string>): ActionResult<never> {
  return { ok: false, error: "Check the highlighted fields.", fieldErrors }
}

/** The currency must be enabled in settings; an edit may keep its current one. */
export async function currencyError(
  currency: string,
  field: string,
  current?: string
): Promise<ActionResult<never> | null> {
  const { enabledCurrencies } = await getAppSettings()
  if (currencyOptions(enabledCurrencies, current).includes(currency)) return null
  return fieldProblems({ [field]: `${currency} isn’t turned on in Settings` })
}
