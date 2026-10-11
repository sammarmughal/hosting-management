import type { Metadata } from "next"
import { FileTextIcon, SearchXIcon } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/empty-state"
import { InvoicesTable } from "@/components/invoices/invoices-table"
import { InvoicesToolbar } from "@/components/invoices/invoices-toolbar"
import { Pagination } from "@/components/pagination"
import { Button } from "@/components/ui/button"
import { formatAmount } from "@/lib/domain/money"
import type { CurrencyTotal } from "@/lib/domain/money"
import { listInvoices } from "@/lib/data"
import { isFiltered, parseInvoiceParams } from "@/lib/list-filters"
import { hrefWith } from "@/lib/url"

export const metadata: Metadata = { title: "Invoices" }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

// docs/13 §11
export default async function InvoicesPage({ searchParams }: Props) {
  const sp = await searchParams
  const params = parseInvoiceParams(sp)
  const list = await listInvoices(params)

  if (list.totalAll === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface">
        <EmptyState
          icon={FileTextIcon}
          message="No invoices yet. They’re created by the daily check before each renewal, or from a service card."
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
      {/* Totals strip, per currency (never added across currencies, docs/13 §6) */}
      <section
        aria-label="Totals"
        className="flex w-full flex-col divide-y divide-border rounded-lg border border-border bg-surface sm:w-fit sm:max-w-full sm:flex-row sm:flex-wrap sm:divide-x sm:divide-y-0"
      >
        <Figure label="Invoices">{list.total}</Figure>
        <Figure label="Invoiced">
          <Totals totals={list.invoiced} />
        </Figure>
        <Figure label="Outstanding">
          <Totals totals={list.outstanding} />
        </Figure>
      </section>

      <InvoicesToolbar params={params} currencies={list.currencies} />

      <section aria-label="Invoices" className="overflow-hidden rounded-lg border border-border bg-surface">
        {list.total === 0 ? (
          <EmptyState
            icon={SearchXIcon}
            message={params.q ? `No invoices match “${params.q}”.` : "No invoices match these filters."}
            action={
              isFiltered(params) ? (
                <Button asChild variant="outline" size="sm">
                  <Link href="/invoices">Clear filters</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <InvoicesTable rows={list.rows} />
            <Pagination
              page={list.page}
              pageSize={list.pageSize}
              total={list.total}
              hrefFor={(page) => hrefWith("/invoices", sp, { page })}
            />
          </>
        )}
      </section>
      <p className="sr-only" aria-live="polite">
        {plural(list.total, "invoice")} shown
      </p>
    </div>
  )
}

function Totals({ totals }: { totals: CurrencyTotal[] }) {
  if (totals.length === 0) return <span className="text-ink-muted">—</span>
  return (
    <>
      {totals.map((t) => (
        <span key={t.currency} className="mr-4 inline-block last:mr-0">
          <span className="mr-1 text-base font-medium text-ink-muted">{t.currency}</span>
          {formatAmount(t.total)}
        </span>
      ))}
    </>
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
