"use client"

import * as React from "react"
import { PlusIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { BottomNav } from "@/components/layout/bottom-nav"
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts"
import { MobileNav } from "@/components/layout/mobile-nav"
import { titleFor } from "@/components/layout/nav"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { Button } from "@/components/ui/button"
import type { ShellSummary } from "@/types/view"

/** Pages where the mobile floating "Add client" button makes sense. */
const FAB_PATHS = new Set(["/dashboard", "/clients"])

// docs/06 §2 + docs/12 §3/§8: sidebar ≥768px (rail below 1024px),
// topbar, and on mobile a drawer, bottom nav and floating "Add client".
export function AppShell({
  summary,
  crumbs,
  children,
}: {
  summary: ShellSummary
  /** Breadcrumb from the @crumbs slot (empty on top-level pages). */
  crumbs: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [navOpen, setNavOpen] = React.useState(false)
  const showFab = FAB_PATHS.has(pathname)

  return (
    <div className="min-h-dvh md:pl-18 lg:pl-60">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-base font-medium shadow-md focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <Sidebar pathname={pathname} summary={summary} />
      <Topbar
        title={titleFor(pathname)}
        crumbs={crumbs}
        unread={summary.unreadNotifications}
        onOpenMenu={() => setNavOpen(true)}
      />

      <main
        id="main"
        tabIndex={-1}
        className="max-w-7xl px-4 pt-6 pb-[calc(8.5rem+env(safe-area-inset-bottom))] outline-none sm:px-6 md:pt-6 md:pb-10 lg:px-8 lg:pt-8"
      >
        {children}
      </main>

      <BottomNav
        pathname={pathname}
        summary={summary}
        onOpenMore={() => setNavOpen(true)}
      />
      <MobileNav
        open={navOpen}
        onOpenChange={setNavOpen}
        pathname={pathname}
        summary={summary}
      />

      {showFab && (
        <Button
          asChild
          size="lg"
          className="fixed right-4 bottom-[calc(3.5rem+1rem+env(safe-area-inset-bottom))] z-30 h-12 rounded-full px-5 shadow-lg md:hidden"
        >
          <Link href="/clients/new">
            <PlusIcon />
            Add client
          </Link>
        </Button>
      )}

      <KeyboardShortcuts />
    </div>
  )
}
