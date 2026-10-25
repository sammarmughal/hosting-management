import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { SubscriptionForm } from "@/components/subscription-form"
import { nextRenewal } from "@/lib/domain/cycles"
import { todayPK } from "@/lib/domain/dates"
import { getSubscriptionFormOptions } from "@/lib/data"
import { idParam } from "@/lib/subscription-filters"

export const metadata: Metadata = { title: "Add subscription" }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

// docs/14 §4: /subscriptions/new?clientId=&companyId= (both optional).
export default async function NewSubscriptionPage({ searchParams }: Props) {
  const sp = await searchParams
  const options = await getSubscriptionFormOptions()
  const client = options.clients.find((c) => c.id === idParam(sp.clientId))
  const company = client
    ? options.companies.find(
        (c) => c.id === idParam(sp.companyId) && c.clientId === client.id
      )
    : undefined
  const today = todayPK()

  return (
    <>
      <PageHeader
        title="Add subscription"
        description={
          client
            ? `For ${company ? `${company.name} · ` : ""}${client.label}`
            : "Something that renews every year."
        }
      />
      <SubscriptionForm
        mode="new"
        options={options}
        cancelHref={client ? `/clients/${client.id}?tab=subscriptions` : "/subscriptions"}
        defaultValues={{
          clientId: client ? String(client.id) : "",
          companyId: company ? String(company.id) : "",
          serviceTypeId: "",
          domain: "",
          planLabel: "",
          startDate: today,
          renewalDate: nextRenewal(today),
          chargeAmount: "",
          // New subscriptions start in the client's currency (docs/13 §6).
          currency: client?.currency ?? options.defaultCurrency,
          remindersEnabled: true,
          notes: "",
        }}
      />
    </>
  )
}
