import { MailIcon, MessageCircleIcon } from "lucide-react"
import Link from "next/link"

import { ReminderStatusBadge } from "@/components/reminder-status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDateTimePK } from "@/lib/domain/relative-time"
import { stageLabel } from "@/lib/domain/stages"
import { cn } from "@/lib/utils"
import type { ReminderRow } from "@/types/view"

const when = (r: ReminderRow) => (r.sentAt ? formatDateTimePK(r.sentAt) : "Not sent yet")

function Channel({ channel }: { channel: ReminderRow["channel"] }) {
  const Icon = channel === "email" ? MailIcon : MessageCircleIcon
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon aria-hidden className="size-4 text-ink-subtle" />
      {channel === "email" ? "Email" : "WhatsApp"}
    </span>
  )
}

function ErrorText({ error }: { error: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="block truncate rounded-sm text-sm text-red-fg outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          {error}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">{error}</TooltipContent>
    </Tooltip>
  )
}

/**
 * Reminder log rows (docs/06 §4.7 and §4.9). The Reminders page shows
 * domain and client; a client page shows the domain only when the client
 * has more than one service. Cards on mobile.
 */
export function ReminderLogTable({
  rows,
  showDomain,
  showClient = false,
}: {
  rows: ReminderRow[]
  showDomain: boolean
  showClient?: boolean
}) {
  return (
    <div className="@container">
      <div className={cn("hidden", showClient ? "@min-[1100px]:block" : "@min-[700px]:block")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {showDomain && <TableHead>Domain</TableHead>}
              {showClient && <TableHead>Client</TableHead>}
              <TableHead>Stage</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-full">Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className={cn(!r.sentAt && "text-ink-muted")}>
                  {when(r)}
                </TableCell>
                {showDomain && (
                  <TableCell>
                    <Link
                      href={`/clients/${r.service.clientId}`}
                      title={r.service.domain}
                      className="block max-w-48 truncate hover:underline"
                    >
                      {r.service.domain}
                    </Link>
                  </TableCell>
                )}
                {showClient && (
                  <TableCell>
                    <div
                      className="max-w-48 truncate text-ink-muted"
                      title={r.service.clientName}
                    >
                      {r.service.clientName}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-ink-muted">{stageLabel(r.stage)}</TableCell>
                <TableCell>
                  <Channel channel={r.channel} />
                </TableCell>
                <TableCell className="text-ink-muted">
                  {r.recipient === "client" ? "Client" : "You"}
                </TableCell>
                <TableCell>
                  <ReminderStatusBadge status={r.status} />
                </TableCell>
                {/* max-w-0 + a w-full column: the error takes the width that's left and truncates */}
                <TableCell className="max-w-48 min-w-32">
                  {r.lastError ? <ErrorText error={r.lastError} /> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className={cn("divide-y divide-border", showClient ? "@min-[1100px]:hidden" : "@min-[700px]:hidden")}>
        {rows.map((r) => (
          <li key={r.id} className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/clients/${r.service.clientId}`} title={r.service.domain} className="min-w-0 truncate font-medium min-h-11 inline-flex items-center hover:underline">
                {r.service.domain}
              </Link>
              <ReminderStatusBadge status={r.status} />
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm text-ink-muted">
              <Channel channel={r.channel} />
              <span>· {r.recipient === "client" ? "Client" : "You"}</span>
            </div>
            <div
              className="mt-1 truncate text-sm text-ink-muted"
              title={r.service.clientName}
            >
              {stageLabel(r.stage)}
              {showClient && ` · ${r.service.clientName}`}
            </div>
            <div className="mt-0.5 text-sm text-ink-muted">{when(r)}</div>
            {r.lastError && (
              <div className="mt-1">
                <ErrorText error={r.lastError} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
