import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { getCompany } from "@/lib/data"

export default async function EditCompanyCrumbs({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const c = await getCompany(Number((await params).id))
  if (!c) return null
  return (
    <Breadcrumbs
      items={[
        { label: "Companies", href: "/companies" },
        { label: c.clientName, href: `/clients/${c.clientId}?tab=companies` },
        { label: "Edit company" },
      ]}
    />
  )
}
