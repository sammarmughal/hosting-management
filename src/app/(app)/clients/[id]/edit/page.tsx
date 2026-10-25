import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ClientForm } from "@/components/client-form"
import { PageHeader } from "@/components/page-header"
import { currencyOptions } from "@/lib/domain/currency"
import { formatPhone } from "@/lib/domain/whatsapp"
import { getClient, getSettings } from "@/lib/data"

type Props = { params: Promise<{ id: string }> }

async function load(params: Props["params"]) {
  const data = await getClient(Number((await params).id))
  if (!data) notFound()
  return data.client
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const client = await load(params)
  return { title: `Edit ${client.name}` }
}

export default async function EditClientPage({ params }: Props) {
  const [client, settings] = await Promise.all([load(params), getSettings()])
  return (
    <>
      <PageHeader title="Edit client" description={client.name} />
      <ClientForm
        mode="edit"
        clientId={client.id}
        currencies={currencyOptions(settings.enabledCurrencies, client.currency)}
        defaultValues={{
          name: client.name,
          email: client.email ?? "",
          phone: client.phone ? formatPhone(client.phone) : "",
          address: client.address ?? "",
          currency: client.currency,
          notes: client.notes ?? "",
        }}
      />
    </>
  )
}
