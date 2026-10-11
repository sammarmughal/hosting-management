import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ServiceForm } from "@/components/client-form"
import { PageHeader } from "@/components/page-header"
import { addOneYear, todayPK } from "@/lib/domain/dates"
import { currencyOptions } from "@/lib/domain/currency"
import { getClient, getSettings } from "@/lib/data"

type Props = { params: Promise<{ id: string }> }

async function load(params: Props["params"]) {
  const data = await getClient(Number((await params).id))
  if (!data) notFound()
  return data.client
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const client = await load(params)
  return { title: `Add service for ${client.name}` }
}

export default async function NewServicePage({ params }: Props) {
  const [client, settings] = await Promise.all([load(params), getSettings()])
  const today = todayPK()
  return (
    <>
      <PageHeader title="Add service" description={`For ${client.name}`} />
      <ServiceForm
        mode="new"
        clientId={client.id}
        currencies={currencyOptions(settings.enabledCurrencies, client.currency)}
        defaultValues={{
          domain: "",
          planLabel: "",
          startDate: today,
          renewalDate: addOneYear(today),
          chargeAmount: "",
          // New services start in the client's currency (docs/13 §6).
          currency: client.currency,
          remindersEnabled: true,
          notes: "",
        }}
      />
    </>
  )
}
