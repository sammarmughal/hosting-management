import { invoiceFilename } from "@/lib/domain/invoices"
import { renderInvoicePdf } from "@/lib/server/invoice-pdf"
import { recordInvoiceEvent } from "@/lib/server/invoices"
import { lookupPublicInvoice } from "@/lib/server/public-invoice"
import { clientIp } from "@/lib/server/session"

export const runtime = "nodejs"

const NEUTRAL = "This invoice link is no longer valid."

/** GET /i/[token]/pdf (docs/13 §7–§8): public, no login, rate limited. */
export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const ip = await clientIp()
  const found = await lookupPublicInvoice(token, ip)
  if (!found.ok) {
    return new Response(
      found.reason === "rate_limited" ? "Too many requests. Try again in a few minutes." : NEUTRAL,
      {
        status: found.reason === "rate_limited" ? 429 : 404,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      }
    )
  }
  const { invoice } = found
  const pdf = await renderInvoicePdf(invoice.document)
  await recordInvoiceEvent(invoice.id, "pdf_downloaded", { via: "link" }, { ip })
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoiceFilename(invoice.document.number, invoice.domain)}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  })
}
