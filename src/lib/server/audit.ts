import "server-only"

import type { Prisma } from "@/generated/prisma/client"
import { prisma, type Tx } from "@/lib/server/db"

/** docs/05 §11. Never throws: an audit failure must not break the action. */
export async function audit(
  action: string,
  opts: {
    entity?: string
    entityId?: number
    details?: Prisma.InputJsonValue
    ip?: string | null
    db?: Tx
  } = {}
) {
  try {
    await (opts.db ?? prisma).auditLog.create({
      data: {
        action,
        entity: opts.entity ?? null,
        entityId: opts.entityId ?? null,
        details: opts.details,
        ip: opts.ip ?? null,
      },
    })
  } catch (err) {
    console.error("audit failed", action, err)
  }
}
