import type { Metadata } from "next"
import { DownloadIcon, FileUpIcon, PlusIcon, SearchXIcon, UsersIcon } from "lucide-react"
import Link from "next/link"

import { ClientsToolbar } from "@/components/clients/clients-toolbar"
import { FilterChips } from "@/components/clients/filter-chips"
import { EmptyState } from "@/components/empty-state"
import { FlashToast } from "@/components/flash-toast"
import { Pagination } from "@/components/pagination"
import { ServicesTable } from "@/components/services-table"
import { Button } from "@/components/ui/button"
import { todayPK } from "@/lib/domain/dates"
import { listServices } from "@/lib/data"
import { clientsHref, hasActiveFilters, parseClientsParams } from "@/lib/service-filters"

export const metadata: Metadata = { title: "Clients" }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** "Renews in" options: 2 months back (recent expiries) to 11 ahead. */
function monthOptions(today: string) {
  const [y = 0, m = 1] = today.split("-").map(Number)
  const base = y * 12 + (m - 1)
  return Array.from({ length: 14 }, (_, i) => {
    const total = base - 2 + i
    const year = Math.floor(total / 12)
    const month = total % 12
    return {
      value: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: `${MONTH_NAMES[month]} ${year}`,
    }
  })
}

const FLASH: Record<string, string> = { client: "Client deleted" }

// docs/06 §4.5. Every view is described by the URL (docs/07 §1).
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params = parseClientsParams(sp)
  const list = await listServices(params)
  const clientCount = new Set(list.rows.map((r) => r.clientId)).size
  const deleted = typeof sp.deleted === "string" ? (FLASH[sp.deleted] ?? null) : null

  return (
    <div className="flex flex-col gap-4">
      <FlashToast message={deleted} param="deleted" />

      {/* Header row: the topbar already shows the "Clients" H1. When there are
          no clients, the empty state carries the actions instead. */}
      {list.totalAll > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-base text-ink-muted tabular-nums">
            {plural(list.totalAll, "service")}
          </p>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="text-ink-muted">
              <Link href="/import">
                <FileUpIcon />
                Import
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-ink-muted">
              <a href="/api/export/services" download>
                <DownloadIcon />
                Export CSV
              </a>
            </Button>
            {/* On mobile the floating "Add client" button does this */}
            <Button asChild size="sm" className="ml-1 hidden md:inline-flex">
              <Link href="/clients/new">
                <PlusIcon />
                Add client
              </Link>
            </Button>
          </div>
        </div>
      )}

      {list.totalAll === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={UsersIcon}
            message="No clients yet. Add your first client to start tracking renewals."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <Link href="/clients/new">
                    <PlusIcon />
                    Add your first client
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/import">Import from CSV</Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <ClientsToolbar params={params} months={monthOptions(todayPK())} />
            <FilterChips params={params} counts={list.counts} />
          </div>

          <section
            aria-label="Services"
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            {list.total === 0 ? (
              <EmptyState
                icon={SearchXIcon}
                message={
                  params.q
                    ? `No clients match “${params.q}”.`
                    : "No services match these filters."
                }
                action={
                  hasActiveFilters(params) ? (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={clientsHref(params, { q: "", filter: "all", month: "" })}
                      >
                        Clear filters
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <ServicesTable rows={list.rows} showStartDate />
                <Pagination
                  page={list.page}
                  pageSize={list.pageSize}
                  total={list.total}
                  hrefFor={(page) => clientsHref(params, { page })}
                />
              </>
            )}
          </section>
          <p className="sr-only" aria-live="polite">
            {plural(list.total, "service")} shown from {plural(clientCount, "client")}
          </p>
        </>
      )}
    </div>
  )
}
