import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { InvoiceActionsPanel } from "@/components/invoices/invoice-actions-panel"
import { InvoiceDocument } from "@/components/invoices/invoice-document"
import { InvoiceTimeline } from "@/components/invoices/invoice-timeline"
import { PageHeader } from "@/components/page-header"
import { getInvoice, getInvoiceShareData } from "@/lib/data"

type Props = { params: Promise<{ id: string }> }

async function load(params: Props["params"]) {
  const id = Number((await params).id)
  const [invoice, share] = await Promise.all([getInvoice(id), getInvoiceShareData(id)])
  if (!invoice || !share) notFound()
  return { invoice, share }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { invoice } = await load(params)
  return { title: invoice.number }
}

// docs/13 §11: preview on the left, actions + timeline on the right.
export default async function InvoicePage({ params }: Props) {
  const { invoice, share } = await load(params)
  return (
    <>
      <PageHeader
        title={<span className="font-mono">{invoice.number}</span>}
        description={
          <>
            {invoice.subscription.serviceName} · {invoice.subscription.domain} ·{" "}
            <Link
              href={`/clients/${invoice.subscription.clientId}`}
              data-slot="inline-link"
              className="hover:underline"
            >
              {invoice.billTo.name}
            </Link>
            {invoice.billTo.company && <> · {invoice.billTo.company.name}</>}
          </>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <InvoiceDocument invoice={invoice} className="order-2 xl:order-1" />
        <div className="order-1 flex flex-col gap-6 xl:sticky xl:top-21 xl:order-2">
          <InvoiceActionsPanel invoice={invoice} share={share} />
          <div className="hidden xl:block">
            <InvoiceTimeline events={invoice.events} />
          </div>
        </div>
        <div className="order-3 xl:hidden">
          <InvoiceTimeline events={invoice.events} />
        </div>
      </div>
    </>
  )
}
