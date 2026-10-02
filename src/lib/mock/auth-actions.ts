"use server"

import { randomBytes } from "node:crypto"
import { z } from "zod"
import type { ActionResult } from "@/types/actions"

// Phase 1 fixtures, not authentication. Documented in docs/13-UI-REVIEW.md.
const pause = () => new Promise((resolve) => setTimeout(resolve, 400))
export async function loginAction(
  identifier: string,
  password: string
): Promise<ActionResult> {
  await pause()
  return ["rehman", "billing@rehmanweb.pk"].includes(identifier.trim().toLowerCase()) &&
    password === "Renewals2026!"
    ? { ok: true }
    : { ok: false, error: "Invalid credentials." }
}
export async function verifyCodeAction(
  code: string,
  recovery = false
): Promise<ActionResult> {
  await pause()
  return code === (recovery ? "A1B2-C3D4" : "123456")
    ? { ok: true }
    : {
        ok: false,
        error: recovery ? "Invalid recovery code." : "Invalid verification code.",
      }
}
export async function setupCodeAction(
  code: string
): Promise<ActionResult<{ codes: string[] }>> {
  const result = await verifyCodeAction(code)
  if (!result.ok) return result
  return {
    ok: true,
    data: {
      codes: Array.from({ length: 8 }, () =>
        randomBytes(4)
          .toString("hex")
          .toUpperCase()
          .replace(/(.{4})/, "$1-")
      ),
    },
  }
}
export async function requestResetAction(email: string): Promise<ActionResult> {
  await pause()
  return z.email().safeParse(email).success
    ? { ok: true }
    : { ok: false, error: "Enter a valid email address." }
}
export async function resetPasswordAction(
  token: string,
  password: string,
  confirm: string
): Promise<ActionResult> {
  await pause()
  if (!token || token === "expired")
    return { ok: false, error: "This reset link has expired. Request a new one." }
  if (password.length < 12) return { ok: false, error: "Use at least 12 characters." }
  if (password !== confirm) return { ok: false, error: "Passwords do not match." }
  return { ok: true }
}
