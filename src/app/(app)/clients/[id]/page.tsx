import type { Metadata } from "next"
import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { ClientActions } from "@/components/client-detail/client-actions"
import { ClientTabs, type ClientTab } from "@/components/client-detail/client-tabs"
import { ContactCard } from "@/components/client-detail/contact-card"
import { ServiceCard } from "@/components/client-detail/service-card"
import { FlashToast } from "@/components/flash-toast"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { getClient } from "@/lib/data"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function load(params: Props["params"]) {
  const data = await getClient(Number((await params).id))
  if (!data) notFound()
  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { client } = await load(params)
  return { title: client.name }
}

const FLASH: Record<string, string> = { client: "Client saved", service: "Service saved" }
const TABS: ClientTab[] = ["payments", "log", "activity"]

// docs/06 §4.7
export default async function ClientPage({ params, searchParams }: Props) {
  const [{ client, payments, reminders, activity }, sp] = await Promise.all([
    load(params),
    searchParams,
  ])
  const saved = typeof sp.saved === "string" ? (FLASH[sp.saved] ?? null) : null
  const tab = TABS.find((t) => t === sp.tab) ?? "payments"
  const paymentsBy = (serviceId: number) =>
    payments.filter((p) => p.serviceId === serviceId).length

  return (
    <>
      <FlashToast message={saved} param="saved" />
      <PageHeader
        title={client.name}
        description={client.company}
        actions={
          <ClientActions
            clientId={client.id}
            clientName={client.name}
            serviceCount={client.services.length}
            paymentCount={payments.length}
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="order-2 flex min-w-0 flex-col gap-6 xl:order-1">
          <section aria-labelledby="services-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 id="services-title" className="text-base font-semibold">
                Services{" "}
                <span className="font-normal text-ink-subtle tabular-nums">
                  {client.services.length}
                </span>
              </h2>
              <Button asChild variant="outline" size="sm">
                <Link href={`/clients/${client.id}/services/new`}>
                  <PlusIcon />
                  Add service
                </Link>
              </Button>
            </div>
            {client.services.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface px-4 py-8 text-sm text-ink-muted sm:px-5">
                No hosting services yet. Add one to start tracking its renewal.
              </p>
            ) : (
              client.services.map((s) => (
                <ServiceCard key={s.id} service={s} paymentCount={paymentsBy(s.id)} />
              ))
            )}
          </section>

          <ClientTabs
            initialTab={tab}
            payments={payments}
            reminders={reminders}
            activity={activity}
            multipleServices={client.services.length > 1}
          />
        </div>

        <aside className="order-1 xl:sticky xl:top-21 xl:order-2">
          <ContactCard client={client} />
        </aside>
      </div>
    </>
  )
}
