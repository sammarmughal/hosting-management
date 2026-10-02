"use client"

import {
  CalendarClockIcon,
  LayoutDashboardIcon,
  MenuIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { isActive } from "@/components/layout/nav"
import { cn } from "@/lib/utils"
import type { ShellSummary } from "@/types/view"

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/clients", label: "Clients", icon: UsersIcon },
  { href: "/reminders", label: "Reminders", icon: CalendarClockIcon },
]

const itemClass =
  "relative flex h-14 flex-col items-center justify-center gap-1 text-xs font-medium outline-none transition-colors focus-visible:bg-surface-subtle focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 hover:bg-surface-hover"

/** Mobile bottom nav: 56px + the iOS safe area (docs/12 §8). */
export function BottomNav({
  pathname,
  summary,
  onOpenMore,
}: {
  pathname: string
  summary: ShellSummary
  onOpenMore: () => void
}) {
  const moreActive = !ITEMS.some((i) => isActive(pathname, i.href))

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          const count = href === "/reminders" ? summary.remindersDue : 0
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active ? "text-brand-700" : "text-ink-muted")}
              >
                <span className="relative">
                  <Icon aria-hidden className="size-4.5" />
                  {count > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute -top-1.5 -right-3 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs leading-none font-medium ring-2 ring-surface",
                        summary.remindersOverdue
                          ? "bg-red-bg text-red-fg"
                          : "bg-line text-ink-muted"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </span>
                {label}
                {count > 0 && <span className="sr-only">, {count} due</span>}
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={onOpenMore}
            className={cn(
              itemClass,
              "w-full",
              moreActive ? "text-brand-700" : "text-ink-muted"
            )}
          >
            <MenuIcon aria-hidden className="size-4.5" />
            More
          </button>
        </li>
      </ul>
    </nav>
  )
}
