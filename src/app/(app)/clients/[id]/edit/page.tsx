import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { PagePlaceholder } from "@/components/page-placeholder"
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
      <PagePlaceholder>
        The client form: name, company, email, WhatsApp phone and notes.
      </PagePlaceholder>
    </>
  )
}
