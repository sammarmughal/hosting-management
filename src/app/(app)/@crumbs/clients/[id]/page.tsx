import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { getClient } from "@/lib/data"

export default async function ClientCrumbs({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const data = await getClient(Number((await params).id))
  if (!data) return null
  return (
    <Breadcrumbs
      items={[{ label: "Clients", href: "/clients" }, { label: data.client.name }]}
    />
  )
}
