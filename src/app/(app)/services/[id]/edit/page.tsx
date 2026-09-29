import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ServiceForm } from "@/components/client-form"
import { PageHeader } from "@/components/page-header"
import { formatAmount } from "@/lib/domain/money"
import type { Currency } from "@/lib/domain/validation"
import { getService } from "@/lib/data"

type Props = { params: Promise<{ id: string }> }

async function load(params: Props["params"]) {
  const service = await getService(Number((await params).id))
  if (!service) notFound()
  return service
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = await load(params)
  return { title: `Edit ${service.domain}` }
}

export default async function EditServicePage({ params }: Props) {
  const s = await load(params)
  return (
    <>
      <PageHeader title="Edit service" description={`${s.domain} · ${s.clientName}`} />
      <ServiceForm
        mode="edit"
        serviceId={s.id}
        clientId={s.clientId}
        defaultValues={{
          domain: s.domain,
          planLabel: s.planLabel ?? "",
          startDate: s.startDate,
          renewalDate: s.renewalDate,
          chargeAmount: formatAmount(s.chargeAmount),
          currency: s.currency as Currency,
          remindersEnabled: s.remindersEnabled,
          notes: s.notes ?? "",
        }}
      />
    </>
  )
}
