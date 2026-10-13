"use server"

// docs/05 §3 and §9, docs/07 §2 (actions/auth.ts). These run before the admin
// is fully signed in, so they use the password-stage guard, not requireAdmin().
import { redirect } from "next/navigation"
import { z } from "zod"

import { authConfig } from "@/lib/domain/google-auth"
import { deviceLabel } from "@/lib/domain/user-agent"
import { audit } from "@/lib/server/audit"
import {
  consumeRecoveryCode,
  hashPassword,
  hashRecoveryCodes,
  newRecoveryCodes,
  passwordProblem,
  verifyPassword,
  verifyTotp,
} from "@/lib/server/auth"
import { randomToken, sha256 } from "@/lib/server/crypto"
import { prisma } from "@/lib/server/db"
import { MailError, sendMail } from "@/lib/server/mail"
import { getAppSettings } from "@/lib/server/settings"
import {
  clientIp,
  endSession,
  requirePasswordStage,
  startSession,
  userAgent,
} from "@/lib/server/session"
import { alertOnUnusualActivity } from "@/lib/server/login-alert"
import { failureDelay, isLocked, recordAttempt } from "@/lib/server/throttle"
import type { ActionResult } from "@/types/actions"

const INVALID = "Invalid credentials."
const LOCKED = "Too many attempts. Try again in 15 minutes."

// Verified against when the username is unknown, so both paths take as long.
let dummyHash: Promise<string> | null = null
const timingHash = () => (dummyHash ??= hashPassword("not-the-password-0000"))

const loginInput = z.object({
  identifier: z.string().trim().toLowerCase().min(1).max(190),
  password: z.string().min(1).max(200),
})

export async function loginAction(identifier: string, password: string): Promise<ActionResult> {
  // Turned off (PASSWORD_LOGIN_ENABLED=0 with Google configured): same answer as a wrong password.
  if (!authConfig(process.env).passwordLogin) {
    await failureDelay()
    return { ok: false, error: INVALID }
  }
  const parsed = loginInput.safeParse({ identifier, password })
  if (!parsed.success) return { ok: false, error: INVALID }
  const ip = await clientIp()
  const id = parsed.data.identifier

  if (await isLocked(ip, id)) {
    await audit("login.locked", { ip, details: { identifier: id } })
    await failureDelay()
    return { ok: false, error: LOCKED }
  }

  const admin = await prisma.admin.findFirst({
    where: { OR: [{ username: { equals: id } }, { email: id }] },
  })
  const ok = admin
    ? await verifyPassword(admin.passwordHash, parsed.data.password)
    : (await verifyPassword(await timingHash(), parsed.data.password)) && false

  if (!admin || !ok) {
    await recordAttempt(ip, id, "password", false)
    await audit("login.failed", { ip, details: { identifier: id } })
    await alertOnUnusualActivity()
    await failureDelay()
    return { ok: false, error: INVALID }
  }

  await recordAttempt(ip, id, "password", true)
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  await startSession(admin.id, "password_ok")
  redirect(admin.totpEnabled ? "/2fa" : "/2fa/setup")
}

/** Promotes the session to full and records the sign-in. Redirects to the dashboard. */
async function completeSignIn(adminId: number, previousSessionId: string): Promise<never> {
  const [ip, ua] = await Promise.all([clientIp(), userAgent()])
  const session = await startSession(adminId, "full", previousSessionId)
  await prisma.admin.update({
    where: { id: adminId },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  })
  await audit("login.success", {
    ip,
    details: { device: deviceLabel(ua), session: session.id.slice(0, 16) },
  })
  redirect("/dashboard")
}

/** One more wrong code; the 5th ends the session (docs/05 §4). */
async function codeFailed(sessionId: string, identifier: string, recovery: boolean) {
  const ip = await clientIp()
  const s = await prisma.session.update({
    where: { id: sessionId },
    data: { totpFailures: { increment: 1 } },
  })
  await recordAttempt(ip, identifier, recovery ? "recovery" : "totp", false)
  await audit("2fa.failed", { ip })
  await failureDelay()
  if (s.totpFailures >= 5) {
    await endSession(sessionId)
    redirect("/login?expired=1")
  }
}

const codeInput = z.string().trim().min(1).max(40)

export async function verifyCodeAction(code: string, recovery = false): Promise<ActionResult> {
  const stage = await requirePasswordStage()
  if (!stage) redirect("/login?expired=1")
  const { admin, session } = stage
  if (!admin.totpEnabled || !admin.totpSecretEnc) redirect("/2fa/setup")
  const parsed = codeInput.safeParse(code)

  if (recovery) {
    const remaining = parsed.success
      ? await consumeRecoveryCode(admin.recoveryCodes, parsed.data)
      : null
    if (!remaining) {
      await codeFailed(session.id, admin.username, true)
      return { ok: false, error: "Invalid recovery code." }
    }
    await prisma.admin.update({ where: { id: admin.id }, data: { recoveryCodes: remaining } })
    await audit("2fa.recovery_used", { details: { remaining: remaining.length } })
    return completeSignIn(admin.id, session.id)
  }

  const result = parsed.success
    ? await verifyTotp(admin.totpSecretEnc, parsed.data, admin.totpLastStep)
    : { ok: false as const }
  if (!result.ok) {
    await codeFailed(session.id, admin.username, false)
    return { ok: false, error: "Invalid verification code." }
  }
  await prisma.admin.update({ where: { id: admin.id }, data: { totpLastStep: result.step } })
  return completeSignIn(admin.id, session.id)
}

/** Step 2 of /2fa/setup: confirms the pending secret, enables 2FA, returns the recovery codes once. */
export async function setupCodeAction(
  code: string
): Promise<ActionResult<{ codes: string[] }>> {
  const stage = await requirePasswordStage()
  if (!stage) redirect("/login?expired=1")
  const { admin, session } = stage
  if (!session.pendingTotpSecretEnc)
    return { ok: false, error: "This setup has expired. Reload the page to start again." }
  const parsed = codeInput.safeParse(code)
  const result = parsed.success
    ? await verifyTotp(session.pendingTotpSecretEnc, parsed.data, null)
    : { ok: false as const }
  if (!result.ok) {
    await codeFailed(session.id, admin.username, false)
    return { ok: false, error: "Invalid verification code." }
  }
  const codes = newRecoveryCodes()
  await prisma.$transaction([
    prisma.admin.update({
      where: { id: admin.id },
      data: {
        totpSecretEnc: session.pendingTotpSecretEnc,
        totpEnabled: true,
        totpLastStep: result.step,
        recoveryCodes: await hashRecoveryCodes(codes),
      },
    }),
    prisma.session.update({
      where: { id: session.id },
      data: { pendingTotpSecretEnc: null, totpFailures: 0 },
    }),
  ])
  await audit("2fa.setup", { ip: await clientIp() })
  return { ok: true, data: { codes } }
}

/** Step 3 of /2fa/setup: after "I have saved these codes". */
export async function finishSetupAction(): Promise<ActionResult> {
  const stage = await requirePasswordStage()
  if (!stage) redirect("/login?expired=1")
  if (!stage.admin.totpEnabled) return { ok: false, error: "Confirm a code first." }
  return completeSignIn(stage.admin.id, stage.session.id)
}

/* Password reset (docs/05 §9) ---------------------------------------- */

export async function requestResetAction(email: string): Promise<ActionResult> {
  const parsed = z.email().safeParse(String(email ?? "").trim().toLowerCase())
  if (!parsed.success) return { ok: false, error: "Enter a valid email address." }
  // No password sign-in, so no reset links either (the answer stays the same).
  if (!authConfig(process.env).passwordLogin) return { ok: true }
  const ip = await clientIp()
  // Always the same answer, whether or not the address exists.
  if (await isLocked(ip, parsed.data)) return { ok: true }
  await recordAttempt(ip, parsed.data, "reset", false)
  const admin = await prisma.admin.findUnique({ where: { email: parsed.data } })
  if (!admin) return { ok: true }

  const token = randomToken()
  await prisma.passwordReset.create({
    data: {
      adminId: admin.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  })
  const link = `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/reset/${token}`
  try {
    const s = await getAppSettings()
    await sendMail(s, {
      to: admin.email,
      subject: "Reset your Renewals password",
      html: `<p>Someone asked to reset the password for your Renewals account.</p><p><a href="${link}">Choose a new password</a></p><p>The link works once and expires in 30 minutes. If this wasn't you, ignore this email.</p>`,
      text: `Reset your Renewals password: ${link}\n\nThe link works once and expires in 30 minutes. If this wasn't you, ignore this email.`,
    })
  } catch (err) {
    console.error("password reset email failed", err instanceof MailError ? err.message : err)
  }
  return { ok: true }
}

export async function resetPasswordAction(
  token: string,
  password: string,
  confirm: string
): Promise<ActionResult> {
  const t = z.string().min(20).max(100).safeParse(token)
  const expired = { ok: false as const, error: "This reset link has expired. Request a new one." }
  if (!t.success) return expired
  const problem = passwordProblem(String(password ?? ""))
  if (problem) return { ok: false, error: problem }
  if (password !== confirm) return { ok: false, error: "Passwords do not match." }

  const reset = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(t.data) } })
  if (!reset || reset.usedAt || reset.expiresAt < new Date()) return expired
  await prisma.$transaction([
    prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.admin.update({
      where: { id: reset.adminId },
      data: { passwordHash: await hashPassword(password) },
    }),
    // A normal login, including 2FA, is still needed afterwards.
    prisma.session.deleteMany({ where: { adminId: reset.adminId } }),
  ])
  await audit("password.reset", { ip: await clientIp() })
  return { ok: true }
}

export async function logoutAction(): Promise<void> {
  await endSession()
  await audit("logout", { ip: await clientIp() })
  redirect("/login")
}
