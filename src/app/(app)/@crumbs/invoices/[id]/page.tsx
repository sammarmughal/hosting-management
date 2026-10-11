import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { getInvoice } from "@/lib/data"

export default async function InvoiceCrumbs({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const invoice = await getInvoice(Number((await params).id))
  if (!invoice) return null
  return (
    <Breadcrumbs items={[{ label: "Invoices", href: "/invoices" }, { label: invoice.number }]} />
  )
}
