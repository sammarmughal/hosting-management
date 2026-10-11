import "server-only"

import type { AttemptStep } from "@/generated/prisma/client"
import { prisma } from "@/lib/server/db"

// docs/05 §4: DB-backed, because serverless instances share no memory.
const MIN = 60_000
export const LIMITS = {
  perIp15: 5,
  perIdentifier15: 5,
  perIp24h: 20,
  alertPerHour: 10,
} as const

/** True when this IP or identifier must wait before trying again. */
export async function isLocked(
  ip: string,
  identifier: string,
  now: Date = new Date()
): Promise<boolean> {
  const since15 = new Date(now.getTime() - 15 * MIN)
  const since24h = new Date(now.getTime() - 24 * 60 * MIN)
  const [ip15, id15, ip24] = await Promise.all([
    prisma.loginAttempt.count({
      where: { ip, success: false, attemptedAt: { gte: since15 } },
    }),
    prisma.loginAttempt.count({
      where: { identifier, success: false, attemptedAt: { gte: since15 } },
    }),
    prisma.loginAttempt.count({
      where: { ip, success: false, attemptedAt: { gte: since24h } },
    }),
  ])
  return (
    ip15 >= LIMITS.perIp15 || id15 >= LIMITS.perIdentifier15 || ip24 >= LIMITS.perIp24h
  )
}

export async function recordAttempt(
  ip: string,
  identifier: string,
  step: AttemptStep,
  success: boolean
) {
  await prisma.loginAttempt.create({
    data: { ip, identifier: identifier.slice(0, 190), step, success },
  })
}

/** Failures across all IPs in the last hour (for the "unusual activity" email). */
export async function failuresLastHour(now: Date = new Date()) {
  return prisma.loginAttempt.count({
    where: { success: false, attemptedAt: { gte: new Date(now.getTime() - 60 * MIN) } },
  })
}

/** Fixed delay on every failure (docs/05 §4). */
export const failureDelay = () => new Promise((r) => setTimeout(r, 300))
