import "server-only"

import { prisma } from "@/lib/server/db"

/**
 * Fixed-window rate limit, DB-backed (serverless instances share no memory,
 * docs/05 §4). One atomic upsert per hit. Returns false once `limit` hits
 * happened in the current window.
 */
export async function allowHit(key: string, limit: number, windowSeconds: number) {
  const ms = windowSeconds * 1000
  const windowStart = new Date(Math.floor(Date.now() / ms) * ms)
  const [row] = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key.slice(0, 120)}, ${windowStart}, 1)
    ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
    RETURNING count`
  // Housekeeping now and then: drop windows older than a day.
  if (Math.random() < 0.02)
    await prisma.rateLimit.deleteMany({
      where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } },
    })
  return Number(row?.count ?? 0) <= limit
}

/** docs/13 §8: basic limit on the public invoice routes (/i/*). */
export const PUBLIC_INVOICE_LIMIT = { limit: 60, windowSeconds: 600 } as const
