import "server-only"

import { prisma, type Tx } from "@/lib/server/db"

// The server-side rules for a subscription (docs/14 §4), shared by the
// actions and the CSV import: the company belongs to the client, the service
// type is active, and the identifier isn't already used for that type.

type Db = Tx | typeof prisma

export interface SubscriptionRefs {
  clientId: number
  companyId: number | null
  serviceTypeId: number
  domain: string
}

/**
 * Field errors ({ companyId: "…" }), or null when the subscription may be
 * saved. `id` is the subscription being edited: its own row never counts as
 * a duplicate, and it may keep a type that has been deactivated since.
 */
export async function subscriptionProblems(
  s: SubscriptionRefs,
  opts: { id?: number; currentServiceTypeId?: number } = {},
  db: Db = prisma
): Promise<Record<string, string> | null> {
  const [client, company, type] = await Promise.all([
    db.client.findUnique({ where: { id: s.clientId }, select: { id: true } }),
    s.companyId
      ? db.company.findUnique({ where: { id: s.companyId }, select: { clientId: true } })
      : null,
    db.serviceType.findUnique({ where: { id: s.serviceTypeId } }),
  ])
  if (!client) return { clientId: "That client no longer exists" }
  if (s.companyId && company?.clientId !== s.clientId)
    return { companyId: "Choose one of this client's companies" }
  if (!type) return { serviceTypeId: "Choose the service" }
  if (!type.isActive && type.id !== opts.currentServiceTypeId)
    return { serviceTypeId: `${type.name} is inactive. Choose an active service.` }
  // Same type + identifier, ignoring cancelled ones; the collation ignores case.
  const duplicate = await db.subscription.findFirst({
    where: {
      serviceTypeId: s.serviceTypeId,
      domain: s.domain,
      status: "active",
      ...(opts.id ? { id: { not: opts.id } } : {}),
    },
    select: { id: true },
  })
  if (duplicate)
    return { domain: `${s.domain} already has an active ${type.name} subscription` }
  return null
}
