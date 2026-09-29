import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { getService } from "@/lib/data"

export default async function EditServiceCrumbs({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const service = await getService(Number((await params).id))
  if (!service) return null
  return (
    <Breadcrumbs
      items={[
        { label: "Clients", href: "/clients" },
        { label: service.clientName, href: `/clients/${service.clientId}` },
        { label: "Edit service" },
      ]}
    />
  )
}
