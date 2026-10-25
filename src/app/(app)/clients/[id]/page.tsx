import type { Metadata } from "next"
import { Building2Icon, PlusIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import { CompaniesList } from "@/components/companies/companies-list"
import { ClientActions } from "@/components/client-detail/client-actions"
import { ClientTabs } from "@/components/client-detail/client-tabs"
import { ContactCard } from "@/components/client-detail/contact-card"
import { SubscriptionCard } from "@/components/client-detail/subscription-card"
import { FlashToast } from "@/components/flash-toast"
import { PageHeader } from "@/components/page-header"
import { TimerPill } from "@/components/timer-pill"
import { Button } from "@/components/ui/button"
import { CLIENT_TABS } from "@/lib/client-tabs"
import { formatDatePK } from "@/lib/domain/dates"
import { formatMoney } from "@/lib/domain/money"
import { getClient, listClientInvoices } from "@/lib/data"
import type { ClientDetail, SubscriptionRow } from "@/types/view"

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

const FLASH: Record<string, string> = {
  client: "Client saved",
  company: "Company saved",
  subscription: "Subscription saved",
}

// docs/06 §4.7, docs/14 §7
export default async function ClientPage({ params, searchParams }: Props) {
  const [{ client, payments, reminders, activity }, sp] = await Promise.all([
    load(params),
    searchParams,
  ])
  const invoices = await listClientInvoices(client.id)
  const saved = typeof sp.saved === "string" ? (FLASH[sp.saved] ?? null) : null
  const tab = CLIENT_TABS.find((t) => t === sp.tab) ?? "overview"
  const paymentsBy = (subscriptionId: number) =>
    payments.filter((p) => p.subscriptionId === subscriptionId).length
  const addSubscription = `/subscriptions/new?clientId=${client.id}`
  const addCompany = `/companies/new?clientId=${client.id}&from=client`

  return (
    <>
      <FlashToast message={saved} param="saved" />
      <PageHeader
        title={client.name}
        description={
          client.companies.length
            ? client.companies.map((c) => c.name).join(" · ")
            : undefined
        }
        actions={
          <ClientActions
            clientId={client.id}
            clientName={client.name}
            companyCount={client.companies.length}
            subscriptionCount={client.subscriptions.length}
            paymentCount={payments.length}
          />
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="order-2 min-w-0 xl:order-1">
          <ClientTabs
            initialTab={tab}
            companyCount={client.companies.length}
            subscriptionCount={client.subscriptions.length}
            overview={<Overview client={client} addSubscription={addSubscription} />}
            companies={
              <section aria-label="Companies" className="flex flex-col gap-3">
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link href={addCompany}>
                      <PlusIcon />
                      Add company
                    </Link>
                  </Button>
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  {client.companies.length === 0 ? (
                    <p className="px-4 py-8 text-sm text-ink-muted sm:px-5">
                      No companies yet. Add one when this client pays for more than one
                      business; subscriptions can also stay directly under the client.
                    </p>
                  ) : (
                    <CompaniesList
                      rows={client.companies}
                      showClient={false}
                      from="client"
                    />
                  )}
                </div>
              </section>
            }
            subscriptions={
              <SubscriptionsPanel
                client={client}
                paymentsBy={paymentsBy}
                addSubscription={addSubscription}
              />
            }
            payments={payments}
            invoices={invoices}
            reminders={reminders}
            activity={activity}
            multipleSubscriptions={client.subscriptions.length > 1}
          />
        </div>

        <aside className="order-1 xl:sticky xl:top-21 xl:order-2">
          <ContactCard client={client} />
        </aside>
      </div>
    </>
  )
}

/** Counts and the next three renewals (docs/14 §7). */
function Overview({
  client,
  addSubscription,
}: {
  client: ClientDetail
  addSubscription: string
}) {
  const active = client.subscriptions.filter((s) => s.status === "active")
  const next = [...active].sort((a, b) => a.daysLeft - b.daysLeft).slice(0, 3)
  return (
    <section aria-labelledby="next-title" className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Companies" value={client.companies.length} />
        <Stat label="Active subscriptions" value={active.length} />
        <Stat
          label="Cancelled"
          value={client.subscriptions.length - active.length}
          className="max-sm:hidden"
        />
      </dl>
      <div className="flex items-center justify-between gap-3">
        <h2 id="next-title" className="text-base font-semibold">
          Next renewals
        </h2>
        <Button asChild variant="outline" size="sm">
          <Link href={addSubscription}>
            <PlusIcon />
            Add subscription
          </Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {next.length === 0 ? (
          <p className="px-4 py-8 text-sm text-ink-muted sm:px-5">
            No active subscriptions. Add one to start tracking its renewal.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {next.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <Link
                    href={`?tab=subscriptions#sub-${s.id}`}
                    className="block truncate font-medium text-ink hover:underline"
                    title={s.domain}
                  >
                    {s.domain}
                  </Link>
                  <p className="truncate text-sm text-ink-muted">
                    {s.serviceName}
                    {s.company && ` · ${s.company}`} ·{" "}
                    {formatMoney(s.chargeAmount, s.currency)}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-ink-muted">
                  <span className="sm:hidden">{formatDatePK(s.renewalDate)}</span>
                  <TimerPill renewalDate={s.renewalDate} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface px-4 py-3 ${className ?? ""}`}
    >
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  )
}

/** Subscription cards grouped by company, then "No company" (docs/14 §7). */
function SubscriptionsPanel({
  client,
  paymentsBy,
  addSubscription,
}: {
  client: ClientDetail
  paymentsBy: (subscriptionId: number) => number
  addSubscription: string
}) {
  const groups: {
    key: string
    title: string
    companyId: number | null
    rows: SubscriptionRow[]
  }[] = client.companies.map((c) => ({
    key: `c${c.id}`,
    title: c.name,
    companyId: c.id,
    rows: client.subscriptions.filter((s) => s.companyId === c.id),
  }))
  const direct = client.subscriptions.filter((s) => !s.companyId)
  if (direct.length || client.companies.length === 0)
    groups.push({ key: "none", title: "No company", companyId: null, rows: direct })

  return (
    <section aria-label="Subscriptions" className="flex flex-col gap-6">
      <div className="flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={addSubscription}>
            <PlusIcon />
            Add subscription
          </Link>
        </Button>
      </div>
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-3">
          {(client.companies.length > 0 || g.companyId) && (
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
                {g.companyId && (
                  <Building2Icon aria-hidden className="size-4 text-ink-subtle" />
                )}
                <span className="truncate">{g.title}</span>
                <span className="font-normal text-ink-subtle tabular-nums">
                  {g.rows.length}
                </span>
              </h3>
              {g.companyId && (
                <Link
                  href={`${addSubscription}&companyId=${g.companyId}`}
                  className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-brand-700 hover:underline"
                >
                  Add to this company
                </Link>
              )}
            </div>
          )}
          {g.rows.length === 0 ? (
            <p className="rounded-lg border border-border bg-surface px-4 py-6 text-sm text-ink-muted sm:px-5">
              {g.companyId
                ? "No subscriptions for this company yet."
                : "No subscriptions yet. Add one to start tracking its renewal."}
            </p>
          ) : (
            g.rows.map((s) => (
              <SubscriptionCard
                key={s.id}
                subscription={s}
                paymentCount={paymentsBy(s.id)}
              />
            ))
          )}
        </div>
      ))}
    </section>
  )
}
