import type { Metadata } from "next"
import {
  Building2Icon,
  DownloadIcon,
  FileUpIcon,
  PlusIcon,
  SearchXIcon,
} from "lucide-react"
import Link from "next/link"

import { CompaniesList } from "@/components/companies/companies-list"
import { CompaniesToolbar } from "@/components/companies/companies-toolbar"
import { EmptyState } from "@/components/empty-state"
import { FlashToast } from "@/components/flash-toast"
import { Pagination } from "@/components/pagination"
import { Button } from "@/components/ui/button"
import { clientOptions, listCompanies } from "@/lib/data"
import { isFiltered, listHref, parseCompanyListParams } from "@/lib/list-filters"

export const metadata: Metadata = { title: "Companies" }

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

// docs/14 §3. Every view is described by the URL (docs/07 §1).
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params = parseCompanyListParams(sp)
  const [list, clients] = await Promise.all([listCompanies(params), clientOptions()])

  return (
    <div className="flex flex-col gap-4">
      <FlashToast
        message={sp.saved === "company" ? "Company saved" : null}
        param="saved"
      />

      {list.totalAll > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-base text-ink-muted tabular-nums">
            {plural(list.totalAll, "company", "companies")}
          </p>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="text-ink-muted">
              <Link href="/import?kind=companies">
                <FileUpIcon />
                Import
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-ink-muted">
              <a href="/api/export/companies" download>
                <DownloadIcon />
                Export CSV
              </a>
            </Button>
            <Button asChild size="sm" className="ml-1 hidden md:inline-flex">
              <Link href="/companies/new">
                <PlusIcon />
                Add company
              </Link>
            </Button>
          </div>
        </div>
      )}

      {list.totalAll === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={Building2Icon}
            message={
              clients.length
                ? "No companies yet. Add one when a client pays for more than one business."
                : "No companies yet. Add a client first, then their companies."
            }
            action={
              <Button asChild>
                <Link href={clients.length ? "/companies/new" : "/clients/new"}>
                  <PlusIcon />
                  {clients.length ? "Add company" : "Add client"}
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <CompaniesToolbar params={params} clients={clients} />
          <section
            aria-label="Companies"
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            {list.total === 0 ? (
              <EmptyState
                icon={SearchXIcon}
                message="No companies match these filters."
                action={
                  isFiltered(params) ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/companies">Clear filters</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <CompaniesList rows={list.rows} from="companies" />
                <Pagination
                  page={list.page}
                  pageSize={list.pageSize}
                  total={list.total}
                  hrefFor={(page) =>
                    listHref("/companies", { q: params.q, client: params.client, page })
                  }
                />
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
