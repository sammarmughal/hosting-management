"use client"

import { AccountRow } from "@/components/layout/account-row"
import { LogoMark } from "@/components/layout/logo"
import { NavLinks } from "@/components/layout/nav-links"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import type { ShellSummary } from "@/types/view"

/** The mobile drawer: opened by the topbar menu button and "More". */
export function MobileNav({
  open,
  onOpenChange,
  pathname,
  summary,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pathname: string
  summary: ShellSummary
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        // Focus the drawer itself, not its first button (which would pop a tooltip).
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
        className="w-72 gap-0 bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex h-14 items-center gap-3 px-5">
          <LogoMark />
          <SheetTitle className="text-base">Renewals</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </div>
        <nav aria-label="Menu" className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks
            pathname={pathname}
            summary={summary}
            variant="sheet"
            onNavigate={() => onOpenChange(false)}
          />
        </nav>
        <AccountRow name={summary.adminName} />
      </SheetContent>
    </Sheet>
  )
}
