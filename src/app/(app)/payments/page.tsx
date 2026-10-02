import type { Metadata } from "next"
import { DownloadIcon, ReceiptIcon, SearchXIcon } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/empty-state"
import { Pagination } from "@/components/pagination"
import { PaymentsTable } from "@/components/payments-table"
import { PaymentsToolbar } from "@/components/payments/payments-toolbar"
import { Button } from "@/components/ui/button"
import { formatDatePK } from "@/lib/domain/dates"
import { formatAmount } from "@/lib/domain/money"
import { listPayments } from "@/lib/data"
import { isFiltered, parsePaymentParams, type DateRange } from "@/lib/list-filters"
import { hrefWith } from "@/lib/url"

export const metadata: Metadata = { title: "Payments" }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

function rangeLabel({ from, to }: DateRange) {
  if (from && to) return `${formatDatePK(from)} – ${formatDatePK(to)}`
  if (from) return `Since ${formatDatePK(from)}`
  if (to) return `Until ${formatDatePK(to)}`
  return "All time"
}

// docs/06 §4.10
export default async function PaymentsPage({ searchParams }: Props) {
  const sp = await searchParams
  const params = parsePaymentParams(sp)
  const list = await listPayments(params)
  const exportHref = hrefWith(
    "/api/export/payments",
    {},
    { from: params.from, to: params.to, q: params.q }
  )

  if (list.totalAll === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState
          icon={ReceiptIcon}
          message="No payments yet. They’re recorded when you renew a service."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/clients">Go to clients</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary strip: totals for the filtered range, per currency (never summed across) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between">
        <section
          aria-label="Totals"
          className="flex flex-wrap divide-x divide-border rounded-lg border border-border bg-surface"
        >
          <Figure label={`Received · ${rangeLabel(params)}`}>
            {list.totals.length === 0 ? (
              <span className="text-ink-muted">—</span>
            ) : (
              list.totals.map((t) => (
                <span key={t.currency} className="mr-4 inline-block last:mr-0">
                  <span className="mr-1 text-base font-medium text-ink-muted">
                    {t.currency}
                  </span>
                  {formatAmount(t.total)}
                </span>
              ))
            )}
          </Figure>
          <Figure label="Payments">{list.total}</Figure>
        </section>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="self-end text-ink-muted max-md:min-h-11 sm:self-center"
        >
          <a href={exportHref} download>
            <DownloadIcon />
            Export CSV
          </a>
        </Button>
      </div>

      <PaymentsToolbar params={params} />

      <section
        aria-label="Payments"
        className="overflow-hidden rounded-lg border border-border bg-surface"
      >
        {list.total === 0 ? (
          <EmptyState
            icon={SearchXIcon}
            message={
              params.q
                ? `No payments match “${params.q}”.`
                : "No payments in this date range."
            }
            action={
              isFiltered(params) ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/payments">Clear filters</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <PaymentsTable rows={list.rows} showClient showDomain separateReference />
            <Pagination
              page={list.page}
              pageSize={list.pageSize}
              total={list.total}
              hrefFor={(page) => hrefWith("/payments", sp, { page })}
            />
          </>
        )}
      </section>
      <p className="sr-only" aria-live="polite">
        {plural(list.total, "payment")} shown
      </p>
    </div>
  )
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3 sm:px-5">
      <div className="text-sm text-ink-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold text-ink tabular-nums">{children}</div>
    </div>
  )
}
