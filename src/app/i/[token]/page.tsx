import type { Metadata } from "next"
import { DownloadIcon, FileXIcon } from "lucide-react"

import { InvoiceDocument } from "@/components/invoices/invoice-document"
import { Button } from "@/components/ui/button"
import { lookupPublicInvoice, logView } from "@/lib/server/public-invoice"
import { clientIp } from "@/lib/server/session"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ token: string }> }

// Public and never indexed (docs/13 §8); the global X-Robots-Tag header says
// the same.
export const metadata: Metadata = {
  title: { absolute: "Invoice" },
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
}

/** /i/[token]: the invoice for the customer, with Download PDF. No login. */
export default async function PublicInvoicePage({ params }: Props) {
  const { token } = await params
  const ip = await clientIp()
  const found = await lookupPublicInvoice(token, ip)

  if (!found.ok) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="w-full max-w-100 rounded-lg border border-border bg-surface p-6 text-center">
          <FileXIcon aria-hidden className="mx-auto size-6 text-ink-subtle" strokeWidth={1.75} />
          <h1 className="mt-3 text-md font-semibold">
            {found.reason === "rate_limited"
              ? "Too many requests"
              : "This invoice link is no longer valid"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {found.reason === "rate_limited"
              ? "Try again in a few minutes."
              : "Ask the sender for a new link."}
          </p>
        </div>
      </main>
    )
  }

  const { invoice } = found
  await logView(invoice.id, ip)
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-ink-muted">
          Invoice from{" "}
          <span className="font-medium text-ink">{invoice.document.seller.businessName}</span>
        </p>
        <Button asChild size="sm" className="shrink-0 max-sm:h-11">
          <a href={`/i/${token}/pdf`} download>
            <DownloadIcon />
            Download PDF
          </a>
        </Button>
      </div>
      <InvoiceDocument invoice={invoice.document} />
    </main>
  )
}
