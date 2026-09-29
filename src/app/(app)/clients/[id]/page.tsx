import type { Metadata } from "next"
import { notFound } from "next/navigation"

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
  return { title: client.name }
}

export default async function ClientPage({ params }: Props) {
  const client = await load(params)
  return (
    <PagePlaceholder>
      Contact details for {client.name}, services with live timers, and the Payments,
      Reminder log and Activity tabs.
    </PagePlaceholder>
  )
}
