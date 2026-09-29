"use client"

import * as React from "react"
import {
  BellIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  MailXIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDateTimePK, formatRelative } from "@/lib/domain/relative-time"
import { getLatestNotificationsAction, markAllReadAction } from "@/lib/mock/actions"
import { cn } from "@/lib/utils"
import type { NotificationItem } from "@/types/view"

const TYPE_ICON: Record<string, LucideIcon> = {
  reminder_due: CalendarClockIcon,
  email_failed: MailXIcon,
  renewed: CircleCheckIcon,
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <span
      aria-hidden
      className="absolute top-0.5 left-1/2 ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-700 px-1 text-xs leading-none font-medium text-white ring-2 ring-page"
    >
      {count > 9 ? "9+" : count}
    </span>
  )
}

const bellLabel = (unread: number) =>
  unread > 0 ? `Notifications, ${unread} unread` : "Notifications"

/**
 * Desktop: a dropdown with the 10 latest, loaded when it opens (no polling).
 * Mobile: a link to the Notifications page (docs/06 §3.8).
 */
export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = React.useState(initialUnread)
  const [items, setItems] = React.useState<NotificationItem[] | null>(null)
  const [error, setError] = React.useState(false)
  const [marking, startMarking] = React.useTransition()

  async function load() {
    setError(false)
    const res = await getLatestNotificationsAction()
    if (res.ok && res.data) {
      setItems(res.data.items)
      setUnread(res.data.unread)
    } else {
      setError(true)
    }
  }

  function markAll() {
    startMarking(async () => {
      const res = await markAllReadAction()
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? prev)
      setUnread(0)
    })
  }

  return (
    <>
      <Button asChild variant="ghost" size="icon" className="relative md:hidden">
        <Link href="/notifications" aria-label={bellLabel(unread)}>
          <BellIcon />
          <CountBadge count={unread} />
        </Link>
      </Button>

      <DropdownMenu onOpenChange={(open) => open && void load()}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={bellLabel(unread)}
                className="relative hidden md:inline-flex"
              >
                <BellIcon />
                <CountBadge count={unread} />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-96 p-0">
          <div className="flex h-11 items-center justify-between border-b border-border pr-2 pl-4">
            <span className="text-base font-semibold">Notifications</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={markAll}
              loading={marking}
              disabled={unread === 0}
              className="text-ink-muted"
            >
              Mark all read
            </Button>
          </div>

          <div className="max-h-[min(420px,70dvh)] overflow-y-auto p-1">
            {error ? (
              <p className="px-3 py-6 text-sm text-ink-muted">
                Couldn’t load notifications.{" "}
                <button
                  type="button"
                  onClick={() => void load()}
                  className="font-medium text-brand-700 hover:underline"
                >
                  Try again
                </button>
              </p>
            ) : items === null ? (
              Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex gap-3 px-3 py-2.5">
                  <Skeleton className="size-4 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
              ))
            ) : items.length === 0 ? (
              <p className="px-3 py-6 text-sm text-ink-muted">No notifications yet.</p>
            ) : (
              items.map((n) => <NotificationRow key={n.id} item={n} />)
            )}
          </div>

          <div className="border-t border-border p-1">
            <DropdownMenuItem
              asChild
              className="justify-center text-brand-700 focus:text-brand-700"
            >
              <Link href="/notifications">View all notifications</Link>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const Icon = TYPE_ICON[item.type] ?? BellIcon
  const now = new Date()
  return (
    <DropdownMenuItem asChild className="items-start gap-3 px-3 py-2.5">
      <Link href={item.href ?? "/notifications"}>
        <Icon
          aria-hidden
          className={cn(
            "mt-0.5 size-4",
            item.type === "email_failed" ? "text-red-fg" : "text-ink-subtle"
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              "line-clamp-2 text-sm",
              item.isRead ? "text-ink-muted" : "text-ink"
            )}
          >
            {item.title}
          </span>
          <time
            dateTime={item.createdAt}
            title={formatDateTimePK(item.createdAt)}
            className="text-xs text-ink-subtle"
          >
            {formatRelative(item.createdAt, now)}
          </time>
        </span>
        {!item.isRead && (
          <span
            aria-label="Unread"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500"
          />
        )}
      </Link>
    </DropdownMenuItem>
  )
}
