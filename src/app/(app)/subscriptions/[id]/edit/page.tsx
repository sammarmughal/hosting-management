import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { SubscriptionForm } from "@/components/subscription-form"
import { formatAmount } from "@/lib/domain/money"
import { getSubscription, getSubscriptionFormOptions } from "@/lib/data"

type Props = { params: Promise<{ id: string }> }

async function load(params: Props["params"]) {
  const subscription = await getSubscription(Number((await params).id))
  if (!subscription) notFound()
  return subscription
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await load(params)
  return { title: `Edit ${s.domain}` }
}

export default async function EditSubscriptionPage({ params }: Props) {
  const s = await load(params)
  const options = await getSubscriptionFormOptions(s.serviceTypeId)
  return (
    <>
      <PageHeader
        title="Edit subscription"
        description={`${s.serviceName} · ${s.domain} · ${s.company ? `${s.company} · ` : ""}${s.clientName}`}
      />
      <SubscriptionForm
        mode="edit"
        subscriptionId={s.id}
        options={options}
        cancelHref={`/clients/${s.clientId}?tab=subscriptions`}
        defaultValues={{
          clientId: String(s.clientId),
          companyId: s.companyId ? String(s.companyId) : "",
          serviceTypeId: String(s.serviceTypeId),
          domain: s.domain,
          planLabel: s.planLabel ?? "",
          startDate: s.startDate,
          renewalDate: s.renewalDate,
          chargeAmount: formatAmount(s.chargeAmount, s.currency),
          currency: s.currency,
          remindersEnabled: s.remindersEnabled,
          notes: s.notes ?? "",
        }}
      />
    </>
  )
}
