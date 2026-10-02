"use client"

import Link from "next/link"

import { AccountRow } from "@/components/layout/account-row"
import { LogoMark } from "@/components/layout/logo"
import { NavLinks } from "@/components/layout/nav-links"
import type { ShellSummary } from "@/types/view"

// Light sidebar (docs/12 §3): full at ≥1024px, a 72px icon rail at 768–1023px,
// hidden on mobile (the drawer and bottom nav take over).
export function Sidebar({
  pathname,
  summary,
}: {
  pathname: string
  summary: ShellSummary
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-18 flex-col border-r border-border bg-sidebar md:flex lg:w-60">
      <Link
        href="/dashboard"
        className="flex h-15 shrink-0 items-center gap-3 px-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:ring-inset max-lg:justify-center max-lg:px-0"
      >
        <LogoMark />
        <span className="text-base font-semibold text-ink max-lg:sr-only">Renewals</span>
      </Link>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        <NavLinks pathname={pathname} summary={summary} variant="sidebar" />
      </nav>
      <AccountRow name={summary.adminName} rail />
    </aside>
  )
}
