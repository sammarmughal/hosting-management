import "server-only"

import { getInvoiceByToken } from "@/lib/server/invoice-queries"
import { isTokenShaped, recordInvoiceEvent } from "@/lib/server/invoices"
import { prisma } from "@/lib/server/db"
import { allowHit, PUBLIC_INVOICE_LIMIT } from "@/lib/server/rate-limit"

// The public invoice link (docs/13 §8). Callers show one neutral message for
// every failure, so nothing about other invoices leaks.

export type PublicLookup =
  | { ok: true; invoice: NonNullable<Awaited<ReturnType<typeof getInvoiceByToken>>> }
  | { ok: false; reason: "invalid" | "rate_limited" }

export async function lookupPublicInvoice(token: string, ip: string): Promise<PublicLookup> {
  const { limit, windowSeconds } = PUBLIC_INVOICE_LIMIT
  if (!(await allowHit(`i:${ip}`, limit, windowSeconds)))
    return { ok: false, reason: "rate_limited" }
  if (!isTokenShaped(token)) return { ok: false, reason: "invalid" }
  const invoice = await getInvoiceByToken(token)
  return invoice ? { ok: true, invoice } : { ok: false, reason: "invalid" }
}

/** One link_viewed per invoice and IP per 30 minutes (refreshes don't flood the timeline). */
export async function logView(invoiceId: number, ip: string) {
  const recent = await prisma.invoiceEvent.findFirst({
    where: {
      invoiceId,
      type: "link_viewed",
      ip,
      createdAt: { gte: new Date(Date.now() - 30 * 60_000) },
    },
    select: { id: true },
  })
  if (!recent) await recordInvoiceEvent(invoiceId, "link_viewed", undefined, { ip })
}
