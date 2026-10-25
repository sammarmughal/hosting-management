import type { Metadata } from "next"

import { CompanyForm } from "@/components/company-form"
import { PageHeader } from "@/components/page-header"
import { clientOptions } from "@/lib/data"
import { idParam } from "@/lib/subscription-filters"

export const metadata: Metadata = { title: "Add company" }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

// docs/14 §3: /companies/new?clientId= (optional) &from=client (back to the client page).
export default async function NewCompanyPage({ searchParams }: Props) {
  const sp = await searchParams
  const clients = await clientOptions()
  const client = clients.find((c) => c.id === idParam(sp.clientId))
  return (
    <>
      <PageHeader
        title="Add company"
        description={
          client ? `For ${client.label}` : "A business one of your clients pays for."
        }
      />
      <CompanyForm
        mode="new"
        clients={clients}
        from={sp.from === "client" && client ? "client" : "companies"}
        defaultValues={{
          clientId: client ? String(client.id) : "",
          name: "",
          email: "",
          phone: "",
          address: "",
        }}
      />
    </>
  )
}
