import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

/** "1–25 of 124" with Previous / Next at the bottom right (docs/12 §5). */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
}: {
  page: number
  pageSize: number
  total: number
  hrefFor: (page: number) => string
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const hasPrev = page > 1
  const hasNext = to < total

  return (
    <div className="flex items-center justify-end gap-3 border-t border-border px-4 py-3 sm:px-5">
      <p className="text-sm text-ink-muted tabular-nums" aria-live="polite">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-1">
        <PageLink href={hasPrev ? hrefFor(page - 1) : null} label="Previous page">
          <ChevronLeftIcon />
        </PageLink>
        <PageLink href={hasNext ? hrefFor(page + 1) : null} label="Next page">
          <ChevronRightIcon />
        </PageLink>
      </div>
    </div>
  )
}

function PageLink({
  href,
  label,
  children,
}: {
  href: string | null
  label: string
  children: React.ReactNode
}) {
  if (!href) {
    return (
      <Button variant="outline" size="icon-sm" disabled aria-label={label}>
        {children}
      </Button>
    )
  }
  return (
    <Button asChild variant="outline" size="icon-sm">
      <Link href={href} aria-label={label} title={label}>
        {children}
      </Link>
    </Button>
  )
}
