import type { Metadata } from "next"
import {
  DownloadIcon,
  FileUpIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchXIcon,
} from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/empty-state"
import { FlashToast } from "@/components/flash-toast"
import { Pagination } from "@/components/pagination"
import { SubscriptionsTable } from "@/components/subscriptions-table"
import { FilterChips } from "@/components/subscriptions/filter-chips"
import { SubscriptionsToolbar } from "@/components/subscriptions/subscriptions-toolbar"
import { Button } from "@/components/ui/button"
import { todayPK } from "@/lib/domain/dates"
import { companyOptions, listServiceTypes, listSubscriptions } from "@/lib/data"
import {
  hasActiveFilters,
  parseSubscriptionsParams,
  subscriptionsHref,
} from "@/lib/subscription-filters"

export const metadata: Metadata = { title: "Subscriptions" }

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

// docs/06 §4.5, docs/14 §4. Every view is described by the URL (docs/07 §1).
export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params = parseSubscriptionsParams(sp)
  const [list, companies, types] = await Promise.all([
    listSubscriptions(params),
    companyOptions(),
    listServiceTypes(),
  ])

  return (
    <div className="flex flex-col gap-4">
      <FlashToast
        message={sp.deleted === "subscription" ? "Subscription deleted" : null}
        param="deleted"
      />

      {/* Header row: the topbar already shows the "Subscriptions" H1. With no
          subscriptions, the empty state carries the actions instead. */}
      {list.totalAll > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-base text-ink-muted tabular-nums">
            {plural(list.totalAll, "subscription")}
          </p>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="text-ink-muted">
              <Link href="/import?kind=subscriptions">
                <FileUpIcon />
                Import
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-ink-muted">
              <a href="/api/export/subscriptions" download>
                <DownloadIcon />
                Export CSV
              </a>
            </Button>
            {/* On mobile the floating "Add subscription" button does this */}
            <Button asChild size="sm" className="ml-1 hidden md:inline-flex">
              <Link href="/subscriptions/new">
                <PlusIcon />
                Add subscription
              </Link>
            </Button>
          </div>
        </div>
      )}

      {list.totalAll === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={RefreshCwIcon}
            message="No subscriptions yet. Add a client, then their first subscription."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild>
                  <Link href="/subscriptions/new">
                    <PlusIcon />
                    Add subscription
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/import?kind=subscriptions">Import from CSV</Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <SubscriptionsToolbar
              params={params}
              months={monthOptions(todayPK())}
              companies={companies}
              serviceTypes={types.map((t) => ({ id: t.id, label: t.name }))}
            />
            <FilterChips params={params} counts={list.counts} />
          </div>

          <section
            aria-label="Subscriptions"
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            {list.total === 0 ? (
              <EmptyState
                icon={SearchXIcon}
                message={
                  params.q
                    ? `No subscriptions match “${params.q}”.`
                    : "No subscriptions match these filters."
                }
                action={
                  hasActiveFilters(params) ? (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={subscriptionsHref(params, {
                          q: "",
                          filter: "all",
                          month: "",
                          company: 0,
                          service: 0,
                        })}
                      >
                        Clear filters
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <SubscriptionsTable rows={list.rows} showStartDate />
                <Pagination
                  page={list.page}
                  pageSize={list.pageSize}
                  total={list.total}
                  hrefFor={(page) => subscriptionsHref(params, { page })}
                />
              </>
            )}
          </section>
          <p className="sr-only" aria-live="polite">
            {plural(list.total, "subscription")} shown
          </p>
        </>
      )}
    </div>
  )
}
