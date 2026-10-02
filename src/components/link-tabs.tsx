import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Tabs that are links (?tab=…), so each tab is server-rendered with its own
 * data and URL. Same look as the "line" Tabs variant.
 */
export function LinkTabs({
  label,
  tabs,
}: {
  label: string
  tabs: { href: string; label: string; count?: number; active: boolean }[]
}) {
  return (
    <nav
      aria-label={label}
      className="scrollbar-none overflow-x-auto border-b border-border"
    >
      <ul className="flex gap-1">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              scroll={false}
              aria-current={t.active ? "page" : undefined}
              className={cn(
                "relative inline-flex h-11 items-center gap-1.5 rounded-sm px-2 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 md:h-10",
                t.active ? "text-ink" : "text-ink-muted hover:text-ink",
                "after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-ink after:opacity-0",
                t.active && "after:opacity-100"
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="font-normal text-ink-subtle tabular-nums">
                  {t.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
