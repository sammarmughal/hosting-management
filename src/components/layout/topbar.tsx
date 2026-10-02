"use client"

import { MenuIcon } from "lucide-react"

import { GlobalSearch } from "@/components/layout/global-search"
import { NotificationBell } from "@/components/layout/notification-bell"
import { Button } from "@/components/ui/button"

/**
 * Top-level pages show a plain title (the page's H1). Detail and edit pages
 * render a breadcrumb into `crumbs` (the @crumbs slot); when it is present,
 * CSS hides the plain title and, on mobile, the menu button (the breadcrumb
 * brings its own back arrow). Server-rendered, so nothing flashes.
 */
export function Topbar({
  title,
  crumbs,
  unread,
  onOpenMenu,
  hideSearch = false,
}: {
  title: string
  crumbs: React.ReactNode
  unread: number
  onOpenMenu: () => void
  hideSearch?: boolean
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-page pt-[env(safe-area-inset-top)]">
      <div className="group/topbar flex h-14 max-w-7xl items-center gap-2 px-2 sm:px-4 md:h-15 md:gap-4 md:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={onOpenMenu}
          className="size-11 group-has-data-breadcrumb/topbar:hidden md:hidden"
        >
          <MenuIcon className="size-4" />
        </Button>
        {crumbs}
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-ink group-has-data-breadcrumb/topbar:hidden tracking-[-0.01em]">
          {title}
        </h1>
        {/* The Clients page has its own search, so the topbar one would be a duplicate there. */}
        {!hideSearch && <GlobalSearch className="hidden w-64 md:block lg:w-72" />}
        <NotificationBell initialUnread={unread} />
      </div>
    </header>
  )
}
