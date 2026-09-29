import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { getClient } from "@/lib/data"

export default async function EditClientCrumbs({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const data = await getClient(Number((await params).id))
  if (!data) return null
  const { client } = data
  return (
    <Breadcrumbs
      items={[
        { label: "Clients", href: "/clients" },
        { label: client.name, href: `/clients/${client.id}` },
        { label: "Edit client" },
      ]}
    />
  )
}
