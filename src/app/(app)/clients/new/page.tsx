import type { Metadata } from "next"

import { ClientForm } from "@/components/client-form"
import { PageHeader } from "@/components/page-header"
import { currencyOptions } from "@/lib/domain/currency"
import { getSettings } from "@/lib/data"

export const metadata: Metadata = { title: "Add client" }

export default async function NewClientPage() {
  const settings = await getSettings()

  return (
    <>
      <PageHeader
        title="Add client"
        description="Customer details only. Add their companies and subscriptions next."
      />
      <ClientForm
        mode="new"
        currencies={currencyOptions(settings.enabledCurrencies)}
        defaultValues={{
          name: "",
          email: "",
          phone: "",
          address: "",
          currency: settings.defaultCurrency,
          notes: "",
        }}
      />
    </>
  )
}
