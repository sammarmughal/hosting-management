"use client"

import * as React from "react"
import { attemptAction } from "@/lib/attempt-action"
import { ChevronDownIcon, MailIcon, MessageCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  adminSummaryWhatsappAction,
  sendAdminSummaryEmailAction,
} from "@/lib/mock/actions"

/** "Admin summary ▾": email it to the admin, or open WhatsApp to the admin's own number. */
export function AdminSummaryMenu({
  adminEmail,
  waLink,
  disabled,
  className,
}: {
  adminEmail: string
  waLink: string | null
  disabled?: boolean
  className?: string
}) {
  const [sending, setSending] = React.useState(false)

  async function emailSummary() {
    setSending(true)
    const res = await attemptAction(() => sendAdminSummaryEmailAction())
    setSending(false)
    if (res.ok) toast.success(`Summary emailed to ${adminEmail}`)
    else toast.error("Couldn't email the summary", { description: res.error })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          loading={sending}
          className={className}
        >
          Admin summary
          <ChevronDownIcon className="text-ink-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onSelect={() => void emailSummary()}>
          <MailIcon />
          Email me the summary
        </DropdownMenuItem>
        {waLink ? (
          <DropdownMenuItem asChild>
            {/* A real link: opening a URL after an await would be blocked as a popup. */}
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void attemptAction(() => adminSummaryWhatsappAction())}
            >
              <MessageCircleIcon />
              WhatsApp me the summary
            </a>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <MessageCircleIcon />
            Add your WhatsApp number in Settings
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
