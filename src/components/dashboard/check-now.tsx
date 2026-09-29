"use client"

import * as React from "react"
import { RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useNow } from "@/hooks/use-now"
import { formatDateTimePK, formatRelative } from "@/lib/domain/relative-time"
import { checkNowAction } from "@/lib/mock/actions"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/**
 * "Last checked 10 minutes ago" (absolute time in a tooltip) + Check now.
 * The first render uses the server's label so hydration matches; after
 * mount it follows the shared clock.
 */
export function CheckNow({
  initialLastCheckAt,
  initialLabel,
}: {
  initialLastCheckAt: string
  initialLabel: string
}) {
  const now = useNow()
  const [lastCheckAt, setLastCheckAt] = React.useState(initialLastCheckAt)
  const [checking, setChecking] = React.useState(false)
  const label = now ? formatRelative(lastCheckAt, new Date(now)) : initialLabel

  async function check() {
    setChecking(true)
    const res = await checkNowAction()
    setChecking(false)
    if (!res.ok || !res.data) {
      toast.error("Check failed", { description: res.ok ? undefined : res.error })
      return
    }
    const r = res.data
    setLastCheckAt(r.lastCheckAt)
    const queued = r.queuedNew ? plural(r.queuedNew, "new reminder") : "no new reminders"
    toast.success(`Checked ${plural(r.servicesChecked, "service")} · ${queued}`)
  }

  return (
    <div className="flex items-center gap-3">
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="rounded-sm text-sm text-ink-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            Last checked <time dateTime={lastCheckAt}>{label}</time>
          </span>
        </TooltipTrigger>
        <TooltipContent>{formatDateTimePK(lastCheckAt)}</TooltipContent>
      </Tooltip>
      <Button variant="outline" size="sm" loading={checking} onClick={() => void check()}>
        <RefreshCwIcon />
        Check now
      </Button>
    </div>
  )
}
