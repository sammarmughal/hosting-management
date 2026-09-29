import type { Metadata } from "next"

import { ClientForm } from "@/components/client-form"
import { PageHeader } from "@/components/page-header"
import { addOneYear, todayPK } from "@/lib/domain/dates"
import type { Currency } from "@/lib/domain/validation"
import { getSettings } from "@/lib/data"

export const metadata: Metadata = { title: "Add client" }

export default async function NewClientPage() {
  const settings = await getSettings()
  const today = todayPK()

  return (
    <>
      <PageHeader
        title="Add client"
        description="A client and their first hosting service."
      />
      <ClientForm
        mode="new"
        defaultValues={{
          client: { name: "", company: "", email: "", phone: "", notes: "" },
          service: {
            domain: "",
            planLabel: "",
            startDate: today,
            renewalDate: addOneYear(today),
            chargeAmount: "",
            currency: settings.defaultCurrency as Currency,
            remindersEnabled: true,
            notes: "",
          },
        }}
      />
    </>
  )
}
