import {
  BanIcon,
  BuildingIcon,
  CircleCheckIcon,
  CircleXIcon,
  DownloadIcon,
  EyeIcon,
  FilePlusIcon,
  MailIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  RotateCwIcon,
  type LucideIcon,
} from "lucide-react"

import { formatDateTimePK } from "@/lib/domain/relative-time"
import { cn } from "@/lib/utils"
import type { InvoiceEventItem } from "@/types/view"

const ICON: Record<string, { icon: LucideIcon; className?: string }> = {
  created: { icon: FilePlusIcon },
  updated: { icon: RefreshCwIcon },
  email_sent: { icon: MailIcon },
  email_failed: { icon: CircleXIcon, className: "text-red-fg" },
  whatsapp_opened: { icon: MessageCircleIcon },
  whatsapp_marked_sent: { icon: MessageCircleIcon },
  link_viewed: { icon: EyeIcon },
  pdf_downloaded: { icon: DownloadIcon },
  paid: { icon: CircleCheckIcon, className: "text-green-fg" },
  voided: { icon: BanIcon },
  link_regenerated: { icon: RotateCwIcon },
  details_refreshed: { icon: BuildingIcon },
}

/** The invoice's history (docs/13 §2 InvoiceEvent), newest first. */
export function InvoiceTimeline({ events }: { events: InvoiceEventItem[] }) {
  return (
    <section aria-labelledby="history-title" className="rounded-lg border border-border bg-surface">
      <h2 id="history-title" className="border-b border-border px-4 py-3 text-base font-semibold sm:px-5">
        History
      </h2>
      {events.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted sm:px-5">Nothing yet.</p>
      ) : (
        <ol className="px-4 py-2 sm:px-5">
          {events.map((e, i) => {
            const { icon: Icon, className } = ICON[e.type] ?? { icon: FilePlusIcon }
            return (
              <li key={e.id} className="relative flex gap-3 py-2.5">
                {i < events.length - 1 && (
                  <span aria-hidden className="absolute top-8 bottom-0 left-3.5 w-px bg-border" />
                )}
                <span className="relative flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface">
                  <Icon aria-hidden className={cn("size-4 text-ink-muted", className)} />
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm text-ink">{e.text}</p>
                  {e.detail && <p className="text-xs break-words text-ink-muted">{e.detail}</p>}
                  <time dateTime={e.at} className="text-xs text-ink-muted">
                    {formatDateTimePK(e.at)}
                  </time>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
