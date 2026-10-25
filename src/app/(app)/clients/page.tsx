import type { Metadata } from "next"
import { DownloadIcon, FileUpIcon, PlusIcon, SearchXIcon, UsersIcon } from "lucide-react"
import Link from "next/link"

import { ClientsTable } from "@/components/clients/clients-table"
import { ClientsToolbar } from "@/components/clients/clients-toolbar"
import { EmptyState } from "@/components/empty-state"
import { FlashToast } from "@/components/flash-toast"
import { Pagination } from "@/components/pagination"
import { Button } from "@/components/ui/button"
import { listClients } from "@/lib/data"
import { listHref, parseClientListParams } from "@/lib/list-filters"

export const metadata: Metadata = { title: "Clients" }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

// docs/14 §7: one row per client. Every view is described by the URL (docs/07 §1).
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params = parseClientListParams(sp)
  const list = await listClients(params)

  return (
    <div className="flex flex-col gap-4">
      <FlashToast
        message={sp.deleted === "client" ? "Client deleted" : null}
        param="deleted"
      />

      {list.totalAll > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-base text-ink-muted tabular-nums">
            {plural(list.totalAll, "client")}
          </p>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="text-ink-muted">
              <Link href="/import?kind=clients">
                <FileUpIcon />
                Import
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-ink-muted">
              <a href="/api/export/clients" download>
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
                  <Link href="/import?kind=clients">Import from CSV</Link>
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <>
          <ClientsToolbar params={params} />
          <section
            aria-label="Clients"
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            {list.total === 0 ? (
              <EmptyState
                icon={SearchXIcon}
                message={`No clients match “${params.q}”.`}
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/clients">Clear search</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <ClientsTable rows={list.rows} />
                <Pagination
                  page={list.page}
                  pageSize={list.pageSize}
                  total={list.total}
                  hrefFor={(page) => listHref("/clients", { q: params.q, page })}
                />
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
