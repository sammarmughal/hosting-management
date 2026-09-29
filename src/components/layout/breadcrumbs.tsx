import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"

export interface Crumb {
  label: string
  href?: string
}

/**
 * Topbar breadcrumb for detail and edit pages, rendered from the @crumbs
 * slot. Desktop: "Clients / Bilal Traders / Edit service". Mobile: a back
 * arrow to the parent plus the last crumb. `data-breadcrumb` tells the
 * topbar to hide its plain title and the menu button.
 */
export function Breadcrumbs({ items }: { items: [Crumb, ...Crumb[]] }) {
  const last = items[items.length - 1] ?? items[0]
  const parent = items.length > 1 ? items[items.length - 2] : undefined

  return (
    <nav aria-label="Breadcrumb" data-breadcrumb className="min-w-0 flex-1">
      <div className="flex min-w-0 items-center md:hidden">
        {parent?.href && (
          <Link
            href={parent.href}
            aria-label={`Back to ${parent.label}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink outline-none hover:bg-surface-subtle focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            <ArrowLeftIcon aria-hidden className="size-5" />
          </Link>
        )}
        <span aria-current="page" className="truncate text-md font-semibold text-ink">
          {last.label}
        </span>
      </div>

      <ol className="hidden min-w-0 items-center gap-1.5 text-base md:flex">
        {items.map((c, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-ink-subtle">
                  /
                </span>
              )}
              {isLast || !c.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  title={c.label}
                  className="max-w-72 truncate font-medium text-ink"
                >
                  {c.label}
                </span>
              ) : (
                <Link
                  href={c.href}
                  title={c.label}
                  className="max-w-60 truncate rounded-sm text-ink-muted transition-colors outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  {c.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
