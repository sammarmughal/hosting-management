import { invoiceFilename } from "@/lib/domain/invoices"
import { audit } from "@/lib/server/audit"
import { getInvoiceDocument } from "@/lib/server/invoice-queries"
import { renderInvoicePdf } from "@/lib/server/invoice-pdf"
import { recordInvoiceEvent } from "@/lib/server/invoices"
import { requireAdmin } from "@/lib/server/session"

export const runtime = "nodejs"

/** GET /api/invoices/[id]/pdf (docs/13 §7): authenticated download. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const id = Number((await ctx.params).id)
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 })
  const inv = await getInvoiceDocument(id)
  if (!inv) return new Response("Not found", { status: 404 })
  const pdf = await renderInvoicePdf(inv.document)
  await recordInvoiceEvent(inv.id, "pdf_downloaded", { via: "admin" })
  await audit("invoice.pdf", { entity: "invoice", entityId: inv.id })
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceFilename(inv.document.number, inv.domain)}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
