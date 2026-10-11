import "server-only"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import type { Admin, Session, SessionStage } from "@/generated/prisma/client"
import { pickClientIp } from "@/lib/domain/client-ip"
import { randomToken, sha256 } from "@/lib/server/crypto"
import { prisma } from "@/lib/server/db"

// Database sessions (docs/05 §2): the raw token lives only in the cookie,
// the DB stores sha256(token).

const MIN = 60_000
export const PASSWORD_STAGE_TTL = 5 * MIN
export const FULL_TTL = 12 * 60 * MIN
export const IDLE_LIMIT = 30 * MIN

export const cookieName = () => process.env.SESSION_COOKIE_NAME || "hrm_session"

/**
 * Client IP from the proxy header named by TRUSTED_IP_HEADER (default
 * x-forwarded-for, first value), docs/05 §4 and docs/11.
 */
export async function clientIp(): Promise<string> {
  const h = await headers()
  return pickClientIp((name) => h.get(name), process.env.TRUSTED_IP_HEADER)
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 300) ?? null
}

/**
 * Creates a session and sets the cookie. Server Actions only (cookies can't
 * be set while rendering). Replaces `previousId` when rotating (docs/05 §2).
 */
export async function startSession(
  adminId: number,
  stage: SessionStage,
  previousId?: string
): Promise<Session> {
  const token = randomToken()
  const now = Date.now()
  const [ip, ua] = await Promise.all([clientIp(), userAgent()])
  const session = await prisma.$transaction(async (tx) => {
    if (previousId) await tx.session.deleteMany({ where: { id: previousId } })
    return tx.session.create({
      data: {
        id: sha256(token),
        adminId,
        stage,
        ip,
        userAgent: ua,
        expiresAt: new Date(now + (stage === "full" ? FULL_TTL : PASSWORD_STAGE_TTL)),
      },
    })
  })
  ;(await cookies()).set(cookieName(), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  })
  return session
}

/** The session row for the current cookie, or null (no timeout checks). */
export async function currentSession(): Promise<(Session & { admin: Admin }) | null> {
  const token = (await cookies()).get(cookieName())?.value
  if (!token) return null
  return prisma.session.findUnique({ where: { id: sha256(token) }, include: { admin: true } })
}

/** Deletes the session row and, in actions, the cookie. */
export async function endSession(id?: string) {
  const session = id ? { id } : await currentSession()
  if (session) await prisma.session.deleteMany({ where: { id: session.id } })
  try {
    ;(await cookies()).delete(cookieName())
  } catch {
    // Rendering: cookies are read-only there; the row is gone, which is enough.
  }
}

function expired(session: Session, now: number) {
  return session.expiresAt.getTime() < now || now - session.lastSeenAt.getTime() > IDLE_LIMIT
}

/**
 * The real security check (docs/05 §2): in the (app) layout AND at the top
 * of every Server Action and route handler. Redirects to /login otherwise.
 */
export async function requireAdmin(): Promise<{ admin: Admin; session: Session }> {
  const session = await currentSession()
  const now = Date.now()
  if (!session || session.stage !== "full" || expired(session, now)) {
    if (session) await prisma.session.deleteMany({ where: { id: session.id } })
    redirect(session ? "/login?expired=1" : "/login")
  }
  // Touch at most once a minute to limit writes.
  if (now - session.lastSeenAt.getTime() > MIN)
    await prisma.session.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date(now) },
    })
  return { admin: session.admin, session }
}

/** For /2fa* pages and actions: a live session that passed the password step. */
export async function requirePasswordStage(): Promise<
  { admin: Admin; session: Session } | null
> {
  const session = await currentSession()
  if (!session || session.stage !== "password_ok" || expired(session, Date.now()))
    return null
  return { admin: session.admin, session }
}
