"use client"

import * as React from "react"
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { deleteClientAction } from "@/actions/clients"

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

/** "This deletes 2 companies, 3 subscriptions, 4 payments and all reminders." */
function deleteSummary(companies: number, subscriptions: number, payments: number) {
  const parts = [plural(subscriptions, "subscription")]
  if (companies) parts.unshift(plural(companies, "company", "companies"))
  if (payments) parts.push(plural(payments, "payment"))
  return `This deletes ${parts.join(", ")}, their invoices and all reminders.`
}

export function ClientActions({
  clientId,
  clientName,
  companyCount,
  subscriptionCount,
  paymentCount,
}: {
  clientId: number
  clientName: string
  companyCount: number
  subscriptionCount: number
  paymentCount: number
}) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  return (
    <>
      <Button asChild variant="outline" size="sm">
        <Link href={`/clients/${clientId}/edit`}>
          <PencilIcon />
          Edit
        </Link>
      </Button>
      <DropdownMenu modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="More actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>More actions</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2Icon />
            Delete client
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete ${clientName}?`}
        description={
          <>
            {deleteSummary(companyCount, subscriptionCount, paymentCount)} This can’t be
            undone.
          </>
        }
        confirmLabel="Delete client"
        onConfirm={async () => {
          // Redirects to /clients on success.
          const res = await deleteClientAction(clientId)
          if (res && !res.ok) {
            toast.error(res.error)
            return false
          }
        }}
      />
    </>
  )
}
