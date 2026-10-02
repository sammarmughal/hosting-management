"use client"

import * as React from "react"
import {
  BellIcon,
  CalendarClockIcon,
  CalendarXIcon,
  CircleCheckIcon,
  MailXIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { RelativeTime } from "@/components/relative-time"
import { markReadAction } from "@/lib/mock/actions"
import { cn } from "@/lib/utils"
import type { NotificationItem } from "@/types/view"

/** Muted line icons; status colour only where it means something (expired, failed). */
const TYPE_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  reminder_due: { icon: CalendarClockIcon, className: "text-ink-subtle" },
  expired: { icon: CalendarXIcon, className: "text-expired-fg" },
  email_failed: { icon: MailXIcon, className: "text-red-fg" },
  renewed: { icon: CircleCheckIcon, className: "text-ink-subtle" },
}

/**
 * One notification: type icon, title, relative time and an unread dot. A
 * link to the service's client; opening it marks it read. Used by the bell
 * dropdown (inside a menu item, which passes its props through) and the
 * Notifications page.
 */
export function NotificationRow({
  item,
  initialTime,
  className,
  onClick,
  ...props
}: {
  item: NotificationItem
  /** Server-computed relative time for hydration (page only). */
  initialTime?: string
} & Omit<React.ComponentProps<typeof Link>, "href">) {
  const { icon: Icon, className: iconClass } = TYPE_ICON[item.type] ?? {
    icon: BellIcon,
    className: "text-ink-subtle",
  }

  return (
    <Link
      href={item.href ?? "/notifications"}
      onClick={(e) => {
        onClick?.(e)
        if (!item.isRead) void markReadAction(item.id)
      }}
      className={cn("flex items-start gap-3", className)}
      {...props}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("line-clamp-2", item.isRead ? "text-ink-muted" : "text-ink")}>
          {item.title}
        </span>
        <RelativeTime
          iso={item.createdAt}
          initial={initialTime}
          className="text-xs text-ink-subtle"
        />
      </span>
      {!item.isRead && (
        <span
          role="img"
          aria-label="Unread"
          className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500"
        />
      )}
    </Link>
  )
}
