import "server-only"

import type { ImportContext } from "@/lib/domain/import"
import { today } from "@/lib/server/clock"
import { prisma, type Tx } from "@/lib/server/db"
import { getAppSettings } from "@/lib/server/settings"

/** What the import matches rows against (docs/14 §9), read fresh. */
export async function loadImportContext(
  db: Tx | typeof prisma = prisma
): Promise<ImportContext> {
  const [s, clients, companies, serviceTypes, subscriptions] = await Promise.all([
    getAppSettings(),
    db.client.findMany({
      select: { id: true, name: true, email: true, phone: true, currency: true },
    }),
    db.company.findMany({ select: { id: true, clientId: true, name: true } }),
    db.serviceType.findMany({ select: { id: true, name: true, isActive: true } }),
    db.subscription.findMany({
      where: { status: "active" },
      select: { id: true, serviceTypeId: true, domain: true },
    }),
  ])
  return {
    today: today(),
    currencies: { default: s.defaultCurrency, enabled: s.enabledCurrencies },
    clients,
    companies,
    serviceTypes,
    subscriptions,
  }
}
