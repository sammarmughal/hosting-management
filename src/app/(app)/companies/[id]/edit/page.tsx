import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CompanyForm } from "@/components/company-form"
import { PageHeader } from "@/components/page-header"
import { formatPhone } from "@/lib/domain/whatsapp"
import { clientOptions, getCompany } from "@/lib/data"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function load(params: Props["params"]) {
  const company = await getCompany(Number((await params).id))
  if (!company) notFound()
  return company
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load(params)
  return { title: `Edit ${c.name}` }
}

export default async function EditCompanyPage({ params, searchParams }: Props) {
  const [c, sp, clients] = await Promise.all([
    load(params),
    searchParams,
    clientOptions(),
  ])
  return (
    <>
      <PageHeader title="Edit company" description={`${c.name} · ${c.clientName}`} />
      <CompanyForm
        mode="edit"
        companyId={c.id}
        clients={clients}
        from={sp.from === "client" ? "client" : "companies"}
        defaultValues={{
          clientId: String(c.clientId),
          name: c.name,
          email: c.email ?? "",
          phone: c.phone ? formatPhone(c.phone) : "",
          address: c.address ?? "",
        }}
      />
    </>
  )
}
