"use client"

import { attemptAction } from "@/lib/attempt-action"

import * as React from "react"
import { CheckCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { NotificationRow } from "@/components/notification-row"
import { Button } from "@/components/ui/button"
import { markAllReadAction } from "@/lib/mock/actions"
import type { NotificationItem } from "@/types/view"

export interface NotificationGroup {
  /** "Today", "Yesterday" or "26 Sep 2026" (computed on the server) */
  label: string
  items: (NotificationItem & { initialTime: string })[]
}

/** Grouped notifications with Mark all read (docs/06 §4.11). */
export function NotificationsFeed({ groups }: { groups: NotificationGroup[] }) {
  const [marking, startMarking] = React.useTransition()
  const unread = groups.reduce((n, g) => n + g.items.filter((i) => !i.isRead).length, 0)

  function markAll() {
    startMarking(async () => {
      const res = await attemptAction(() => markAllReadAction())
      if (!res.ok) return void toast.error(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base text-ink-muted" aria-live="polite">
          {unread > 0 ? (
            <>
              <span className="font-medium text-ink tabular-nums">{unread}</span> unread
            </>
          ) : (
            "All read"
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={markAll}
          loading={marking}
          disabled={unread === 0}
          className="max-md:min-h-11"
        >
          <CheckCheckIcon />
          Mark all read
        </Button>
      </div>

      {groups.map((g) => (
        <section key={g.label} aria-labelledby={`day-${g.label}`}>
          <h2 id={`day-${g.label}`} className="mb-2 text-sm font-medium text-ink-muted">
            {g.label}
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {g.items.map(({ initialTime, ...item }) => (
              <li key={item.id}>
                <NotificationRow
                  item={item}
                  initialTime={initialTime}
                  className="px-4 py-3 text-base transition-colors outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
