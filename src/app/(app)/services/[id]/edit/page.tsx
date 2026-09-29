import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/page-header"
import { PagePlaceholder } from "@/components/page-placeholder"
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
  const service = await load(params)
  return (
    <>
      <PageHeader title="Edit service" description={service.domain} />
      <PagePlaceholder>
        The service form: domain, plan, dates, charge and reminders.
      </PagePlaceholder>
    </>
  )
}
