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
import { deleteClientAction } from "@/lib/mock/actions"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

/** "This deletes 2 services, 3 payments and all reminders." */
function deleteSummary(services: number, payments: number) {
  const parts = [plural(services, "service")]
  if (payments) parts.push(plural(payments, "payment"))
  return `This deletes ${parts.join(", ")} and all reminders.`
}

export function ClientActions({
  clientId,
  clientName,
  serviceCount,
  paymentCount,
}: {
  clientId: number
  clientName: string
  serviceCount: number
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
          <>{deleteSummary(serviceCount, paymentCount)} This can’t be undone.</>
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
