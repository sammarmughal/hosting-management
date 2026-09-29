"use client"

import { MenuIcon } from "lucide-react"

import { GlobalSearch } from "@/components/layout/global-search"
import { NotificationBell } from "@/components/layout/notification-bell"
import { Button } from "@/components/ui/button"

export function Topbar({
  title,
  unread,
  onOpenMenu,
}: {
  title: string
  unread: number
  onOpenMenu: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-page pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 max-w-320 items-center gap-2 px-2 sm:px-4 md:h-15 md:gap-4 md:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open menu"
          onClick={onOpenMenu}
          className="size-11 md:hidden"
        >
          <MenuIcon className="size-5" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-md font-semibold text-ink md:text-xl md:tracking-[-0.01em]">
          {title}
        </h1>
        <GlobalSearch className="hidden w-64 md:block lg:w-72" />
        <NotificationBell initialUnread={unread} />
      </div>
    </header>
  )
}
