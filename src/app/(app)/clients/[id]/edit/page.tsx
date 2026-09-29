import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ClientForm } from "@/components/client-form"
import { PageHeader } from "@/components/page-header"
import { formatPhone } from "@/lib/domain/whatsapp"
import { getClient } from "@/lib/data"

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
  const client = await load(params)
  return (
    <>
      <PageHeader title="Edit client" description={client.name} />
      <ClientForm
        mode="edit"
        clientId={client.id}
        defaultValues={{
          name: client.name,
          company: client.company ?? "",
          email: client.email ?? "",
          phone: client.phone ? formatPhone(client.phone) : "",
          notes: client.notes ?? "",
        }}
      />
    </>
  )
}
