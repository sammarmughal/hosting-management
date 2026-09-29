"use client"

import * as React from "react"
import { MessageCircleIcon, MoreHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { RenewDialog } from "@/components/renew-dialog"
import { TimerPill } from "@/components/timer-pill"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatDatePK } from "@/lib/domain/dates"
import { formatMoney } from "@/lib/domain/money"
import { formatPhone } from "@/lib/domain/whatsapp"
import { cn } from "@/lib/utils"
import type { ServiceRow } from "@/types/view"

/** The second line of the client cell: company, else email, else phone. */
function clientDetail(s: ServiceRow) {
  return s.company ?? s.email ?? (s.phone ? formatPhone(s.phone) : null)
}

const clientHref = (s: ServiceRow) => `/clients/${s.clientId}`

/**
 * One row per service (docs/06 §4.4–4.5, docs/12 §5): a table from md up,
 * cards on mobile. Rows link to the client; actions live in a ⋯ menu.
 */
export function ServicesTable({ rows }: { rows: ServiceRow[] }) {
  const router = useRouter()
  const [renewing, setRenewing] = React.useState<ServiceRow | null>(null)
  const [renewOpen, setRenewOpen] = React.useState(false)

  function openRenew(s: ServiceRow) {
    setRenewing(s)
    setRenewOpen(true)
  }

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden md:block">
        <Table className="min-w-180 table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">Client</TableHead>
              <TableHead className="w-[22%]">Domain</TableHead>
              <TableHead className="w-30">Renewal date</TableHead>
              <TableHead className="w-28 text-right">Amount</TableHead>
              <TableHead className="w-48 pl-6">Time left</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow
                key={s.id}
                className="group/row cursor-pointer"
                onClick={(e) => {
                  // Let real links, buttons and menus handle their own clicks.
                  if ((e.target as HTMLElement).closest("a, button, [role='menuitem']"))
                    return
                  router.push(clientHref(s))
                }}
              >
                <TableCell>
                  <Link
                    href={clientHref(s)}
                    title={s.clientName}
                    className="block truncate font-medium text-ink outline-none hover:underline focus-visible:underline"
                  >
                    {s.clientName}
                  </Link>
                  <div
                    className="truncate text-xs text-ink-muted"
                    title={clientDetail(s) ?? ""}
                  >
                    {clientDetail(s)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="truncate" title={s.domain}>
                    {s.domain}
                  </div>
                </TableCell>
                <TableCell className="text-ink-muted">
                  {formatDatePK(s.renewalDate)}
                </TableCell>
                <TableCell className="text-right">
                  {formatMoney(s.chargeAmount, s.currency)}
                </TableCell>
                <TableCell className="pl-6">
                  <TimerPill renewalDate={s.renewalDate} status={s.status} />
                </TableCell>
                <TableCell className="text-right">
                  <RowActions service={s} onRenew={openRenew} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards (docs/06 §4.5) */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((s) => (
          <li key={s.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={clientHref(s)}
                  className="block truncate text-base font-medium text-ink outline-none hover:underline focus-visible:underline"
                >
                  {s.clientName}
                </Link>
                <div className="truncate text-sm text-ink-muted">{s.domain}</div>
              </div>
              <RowActions service={s} onRenew={openRenew} touch />
            </div>
            <div className="mt-1 text-sm text-ink-muted">
              Renews {formatDatePK(s.renewalDate)} ·{" "}
              {formatMoney(s.chargeAmount, s.currency)}
            </div>
            <div className="mt-3">
              <TimerPill renewalDate={s.renewalDate} status={s.status} />
            </div>
            {s.status === "active" && (
              <div className="mt-3 flex gap-2">
                <WhatsAppButton service={s} className="h-11 flex-1" />
                <Button
                  variant="outline"
                  className="h-11 flex-1"
                  onClick={() => openRenew(s)}
                >
                  Renew
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <RenewDialog service={renewing} open={renewOpen} onOpenChange={setRenewOpen} />
    </>
  )
}

/** Opens the prebuilt wa.me link; disabled with a reason when there is no valid phone. */
function WhatsAppButton({
  service,
  className,
}: {
  service: ServiceRow
  className?: string
}) {
  if (!service.waLink) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={cn("inline-flex rounded-md", className)}>
            <Button variant="whatsapp" disabled className="h-full w-full">
              <MessageCircleIcon />
              WhatsApp
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>No valid WhatsApp number</TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Button asChild variant="whatsapp" className={className}>
      <a href={service.waLink} target="_blank" rel="noopener noreferrer">
        <MessageCircleIcon />
        WhatsApp
      </a>
    </Button>
  )
}

function RowActions({
  service,
  onRenew,
  touch = false,
}: {
  service: ServiceRow
  onRenew: (s: ServiceRow) => void
  touch?: boolean
}) {
  return (
    // Non-modal: "Renew" opens a dialog, and a modal menu closing underneath it
    // can leave `pointer-events: none` on the body.
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={touch ? "icon" : "icon-sm"}
              aria-label={`Actions for ${service.domain}`}
              className={cn(
                "text-ink-muted",
                touch
                  ? "-mt-1 -mr-2 size-11"
                  : "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
              )}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={clientHref(service)}>View client</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/services/${service.id}/edit`}>Edit service</Link>
        </DropdownMenuItem>
        {service.status === "active" && (
          <DropdownMenuItem onSelect={() => onRenew(service)}>Renew</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {service.waLink ? (
          <DropdownMenuItem asChild>
            <a href={service.waLink} target="_blank" rel="noopener noreferrer">
              <MessageCircleIcon />
              Open WhatsApp
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <MessageCircleIcon />
            No valid WhatsApp number
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
