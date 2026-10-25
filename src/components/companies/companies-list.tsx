"use client"

import * as React from "react"
import { MoreHorizontalIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
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
import { attemptAction } from "@/lib/attempt-action"
import { companyDeleteText } from "@/lib/domain/companies"
import { formatPhone } from "@/lib/domain/whatsapp"
import { deleteCompanyAction } from "@/actions/companies"
import type { CompanyRow } from "@/types/view"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
const contact = (c: CompanyRow) => c.email ?? (c.phone ? formatPhone(c.phone) : null)

/**
 * Companies (docs/14 §3): a table from 700px of container width up, cards
 * below. `from` tells the edit form where to return.
 */
export function CompaniesList({
  rows,
  showClient = true,
  from,
}: {
  rows: CompanyRow[]
  showClient?: boolean
  from: "companies" | "client"
}) {
  const [deleting, setDeleting] = React.useState<CompanyRow | null>(null)

  return (
    <div className="@container">
      <div className="hidden @min-[700px]:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Company</TableHead>
              {showClient && <TableHead className="w-[22%]">Client</TableHead>}
              <TableHead className="w-28 text-right">Subscriptions</TableHead>
              <TableHead className="w-48 pl-6">Next renewal</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id} className="group/row">
                <TableCell>
                  <div className="truncate font-medium text-ink" title={c.name}>
                    {c.name}
                  </div>
                  <div className="truncate text-xs text-ink-muted">{contact(c)}</div>
                </TableCell>
                {showClient && (
                  <TableCell>
                    <Link
                      href={`/clients/${c.clientId}?tab=companies`}
                      className="block truncate text-ink hover:underline"
                      title={c.clientName}
                    >
                      {c.clientName}
                    </Link>
                  </TableCell>
                )}
                <TableCell className="text-right tabular-nums">
                  {c.subscriptions}
                </TableCell>
                <TableCell className="pl-6">
                  {c.next ? (
                    <TimerPill renewalDate={c.next.renewalDate} />
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <CompanyMenu company={c} from={from} onDelete={() => setDeleting(c)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border @min-[700px]:hidden">
        {rows.map((c) => (
          <li key={c.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-ink" title={c.name}>
                  {c.name}
                </p>
                {showClient && (
                  <Link
                    href={`/clients/${c.clientId}?tab=companies`}
                    className="block truncate text-sm text-ink-muted hover:underline"
                  >
                    {c.clientName}
                  </Link>
                )}
                {contact(c) && (
                  <p className="truncate text-sm text-ink-muted">{contact(c)}</p>
                )}
              </div>
              <CompanyMenu
                company={c}
                from={from}
                onDelete={() => setDeleting(c)}
                touch
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
              {c.next && <TimerPill renewalDate={c.next.renewalDate} />}
              <span>{plural(c.subscriptions, "subscription")}</span>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : ""}
        description={deleting ? companyDeleteText(deleting) : ""}
        confirmLabel="Delete company"
        onConfirm={async () => {
          if (!deleting) return
          const res = await attemptAction(() => deleteCompanyAction(deleting.id))
          if (!res.ok) {
            toast.error(res.error)
            return false
          }
          toast.success(`${deleting.name} deleted`)
        }}
      />
    </div>
  )
}

function CompanyMenu({
  company: c,
  from,
  onDelete,
  touch = false,
}: {
  company: CompanyRow
  from: "companies" | "client"
  onDelete: () => void
  touch?: boolean
}) {
  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size={touch ? "icon" : "icon-sm"}
              aria-label={`Actions for ${c.name}`}
              className={touch ? "-mt-1 -mr-2 size-11 text-ink-muted" : "text-ink-muted"}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/subscriptions/new?clientId=${c.clientId}&companyId=${c.id}`}>
            <PlusIcon />
            Add subscription
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href={`/companies/${c.id}/edit${from === "client" ? "?from=client" : ""}`}
          >
            <PencilIcon />
            Edit company
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2Icon />
          Delete company
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
