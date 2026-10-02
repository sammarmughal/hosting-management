"use server"

import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/mock/auth"
import { preferences } from "@/lib/mock/preferences"
import { MOCK_SETTINGS } from "@/lib/mock/data"
import {
  businessSchema,
  reminderSettingsSchema,
  emailSettingsSchema,
  templateSchema,
  type PreferenceSection,
} from "@/lib/domain/preferences"
import type { ActionResult } from "@/types/actions"

const pause = () => new Promise((resolve) => setTimeout(resolve, 400))
export async function savePreferencesAction(
  section: PreferenceSection,
  input: unknown
): Promise<ActionResult> {
  await requireAdmin()
  const schema =
    section === "business"
      ? businessSchema
      : section === "reminders"
        ? reminderSettingsSchema
        : section === "email"
          ? emailSettingsSchema
          : templateSchema
  const parsed = schema.safeParse(input)
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Check the form fields.",
    }
  await pause()
  const settings = preferences()
  if (section === "business") {
    settings.business = businessSchema.parse(input)
    Object.assign(MOCK_SETTINGS, settings.business)
  } else if (section === "reminders") {
    settings.reminders = reminderSettingsSchema.parse(input)
    MOCK_SETTINGS.thresholds = {
      orange: settings.reminders.orange,
      red: settings.reminders.red,
    }
    MOCK_SETTINGS.stages = settings.reminders.stages
    MOCK_SETTINGS.checkIntervalMinutes = settings.reminders.interval
  } else if (section === "email") {
    const next = emailSettingsSchema.parse(input)
    settings.email = {
      ...next,
      password: "",
      passwordSaved: settings.email.passwordSaved || !!next.password,
    }
  } else if (Object.hasOwn(settings.templates, section))
    settings.templates[section] = templateSchema.parse(input)
  else return { ok: false, error: "Unknown settings section." }
  revalidatePath("/", "layout")
  return { ok: true }
}
export async function sendTestEmailAction(): Promise<ActionResult> {
  await requireAdmin()
  await pause()
  return { ok: true }
}
export async function securityAction(
  kind: "password" | "recovery" | "reset" | "sessions",
  input: { current?: string; next?: string; confirm?: string; code?: string }
): Promise<ActionResult<{ codes?: string[] }>> {
  await requireAdmin()
  await pause()
  if (!["password", "recovery", "reset", "sessions"].includes(kind))
    return { ok: false, error: "Unknown action." }
  if (kind !== "sessions" && input.current !== "Renewals2026!")
    return { ok: false, error: "Current password is incorrect." }
  if ((kind === "password" || kind === "reset") && input.code !== "123456")
    return { ok: false, error: "Invalid verification code." }
  if (
    kind === "password" &&
    (!input.next || input.next.length < 12 || input.next !== input.confirm)
  )
    return {
      ok: false,
      error: "Use at least 12 characters and make sure the passwords match.",
    }
  return {
    ok: true,
    data:
      kind === "recovery"
        ? {
            codes: Array.from({ length: 8 }, () =>
              randomBytes(4)
                .toString("hex")
                .toUpperCase()
                .replace(/(.{4})/, "$1-")
            ),
          }
        : {},
  }
}
