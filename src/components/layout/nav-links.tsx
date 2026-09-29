"use client"

import Link from "next/link"

import { isActive, NAV_ITEMS } from "@/components/layout/nav"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ShellSummary } from "@/types/view"

/**
 * The main navigation list.
 * - "sidebar": full labels from lg, a 72px icon rail with tooltips below lg.
 * - "sheet": full labels with 44px touch targets (mobile drawer).
 */
export function NavLinks({
  pathname,
  summary,
  variant,
  onNavigate,
}: {
  pathname: string
  summary: ShellSummary
  variant: "sidebar" | "sheet"
  onNavigate?: () => void
}) {
  const rail = variant === "sidebar"

  return (
    <ul className={cn("flex flex-col gap-0.5", rail && "max-lg:items-center")}>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
        const count = href === "/reminders" ? summary.remindersDue : 0
        const tooltip = count ? `${label} · ${count} due` : label

        const link = (
          <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 text-base font-medium text-ink-muted transition-colors duration-150 ease-out outline-none hover:bg-surface-subtle hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/40",
              rail ? "h-9 max-lg:size-10 max-lg:justify-center max-lg:px-0" : "h-11",
              active && "bg-surface-subtle text-brand-700 hover:text-brand-700"
            )}
          >
            <Icon aria-hidden className="size-4.5 shrink-0" />
            <span className={cn("truncate", rail && "max-lg:sr-only")}>{label}</span>
            {count > 0 && (
              <>
                <span
                  aria-label={`${count} due${summary.remindersOverdue ? ", some overdue" : ""}`}
                  className={cn(
                    "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium",
                    summary.remindersOverdue
                      ? "bg-red-bg text-red-fg"
                      : "bg-line text-ink-muted",
                    rail && "max-lg:hidden"
                  )}
                >
                  {count}
                </span>
                {rail && (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-2 right-2 size-2 rounded-full ring-2 ring-sidebar lg:hidden",
                      summary.remindersOverdue ? "bg-red" : "bg-ink-subtle"
                    )}
                  />
                )}
              </>
            )}
          </Link>
        )

        return (
          <li key={href}>
            {rail ? (
              <Tooltip>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" className="lg:hidden">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            ) : (
              link
            )}
          </li>
        )
      })}
    </ul>
  )
}
