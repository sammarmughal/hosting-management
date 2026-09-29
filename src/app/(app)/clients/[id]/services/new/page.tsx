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
  return { title: `Add service for ${client.name}` }
}

export default async function NewServicePage({ params }: Props) {
  const client = await load(params)
  return <PagePlaceholder>A new hosting service for {client.name}.</PagePlaceholder>
}
