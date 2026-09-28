"use client"

import * as React from "react"
import { MessageCircleIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function LoadingButtonDemo() {
  const [loading, setLoading] = React.useState(false)

  function send() {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      toast.success("5 reminder emails sent")
    }, 1500)
  }

  return (
    <Button loading={loading} onClick={send}>
      <SendIcon />
      Send 5 emails
    </Button>
  )
}

export function DisabledWithReason() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* Disabled buttons get no pointer events, so the wrapper carries the tooltip. */}
        <span tabIndex={0} className="inline-flex rounded-md">
          <Button variant="whatsapp" disabled>
            <MessageCircleIcon />
            Open WhatsApp
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>No valid WhatsApp number</TooltipContent>
    </Tooltip>
  )
}

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => toast.success("Email sent to Ayesha Siddiqui")}
      >
        Success toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.error("Couldn't send email to Bilal Traders", {
            description: "SMTP login failed. Check the password in Settings.",
            duration: Infinity,
            closeButton: true,
          })
        }
      >
        Error toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast("Reminder skipped for noordental.pk", {
            action: { label: "Undo", onClick: () => toast("Reminder restored") },
          })
        }
      >
        Toast with undo
      </Button>
    </div>
  )
}

export function RenewDialogDemo() {
  const [extendFrom, setExtendFrom] = React.useState("renewal")
  const newDate = extendFrom === "renewal" ? "2 Oct 2027" : "28 Sep 2027"

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Open renew dialog</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-140">
        <DialogHeader>
          <DialogTitle>Renew noordental.pk</DialogTitle>
          <DialogDescription>
            Current renewal date: 2 Oct 2026 (4 days left)
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="renew-amount">Amount</Label>
            <div className="relative">
              <Input
                id="renew-amount"
                inputMode="decimal"
                defaultValue="8,000"
                className="pr-12 text-right"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
                PKR
              </span>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="renew-paid-on">Paid on</Label>
            <Input id="renew-paid-on" type="date" defaultValue="2026-09-28" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="renew-method">Method</Label>
            <Select defaultValue="bank">
              <SelectTrigger id="renew-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="jazzcash">JazzCash</SelectItem>
                <SelectItem value="easypaisa">Easypaisa</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="renew-ref">Reference</Label>
            <Input id="renew-ref" placeholder="Optional" />
          </div>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm font-medium">Extend from</legend>
          <RadioGroup value={extendFrom} onValueChange={setExtendFrom}>
            <Label className="font-normal">
              <RadioGroupItem value="renewal" />
              Current renewal date
              <span className="text-ink-muted">→ 2 Oct 2027</span>
            </Label>
            <Label className="font-normal">
              <RadioGroupItem value="today" />
              Today
              <span className="text-ink-muted">→ 28 Sep 2027</span>
            </Label>
          </RadioGroup>
        </fieldset>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button
              variant="success"
              onClick={() => toast.success(`noordental.pk renewed until ${newDate}`)}
            >
              Renew until {newDate}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
