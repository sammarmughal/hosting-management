"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { TriangleAlertIcon } from "lucide-react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { fieldDescribedBy, FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"
import {
  addDays,
  addOneYear,
  formatDatePK,
  todayPK,
  type ISODate,
} from "@/lib/domain/dates"
import { formatAmount } from "@/lib/domain/money"
import {
  PAYMENT_METHODS,
  renewSchema,
  type RenewData,
  type RenewInput,
} from "@/lib/domain/validation"
import { renewServiceAction } from "@/lib/mock/actions"
import type { ServiceRow } from "@/types/view"

function daysLeftText(d: number) {
  if (d === 0) return "expires today"
  const n = Math.abs(d)
  const days = `${n} ${n === 1 ? "day" : "days"}`
  return d > 0 ? `${days} left` : `expired ${days} ago`
}

/**
 * Renew / Mark paid (docs/06 §4.8, docs/04 §6). Shared by the dashboard,
 * the clients list and the client page. The new renewal date updates live
 * with "Extend from", and a warning appears if it would still be past.
 */
export function RenewDialog({
  service,
  open,
  onOpenChange,
  onRenewed,
}: {
  service: ServiceRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenewed?: (serviceId: number, newRenewalDate: ISODate) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-140">
        {service && (
          <RenewForm
            key={service.id}
            service={service}
            onDone={(date) => {
              onRenewed?.(service.id, date)
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function RenewForm({
  service,
  onDone,
}: {
  service: ServiceRow
  onDone: (newRenewalDate: ISODate) => void
}) {
  const today = React.useMemo(() => todayPK(), [])
  const schema = React.useMemo(() => renewSchema(today), [today])
  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RenewInput, unknown, RenewData>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceId: service.id,
      amount: formatAmount(service.chargeAmount),
      paidOn: today,
      method: "Bank transfer",
      reference: "",
      notes: "",
      extendFrom: "renewal",
    },
  })

  const extendFrom = useWatch({ control, name: "extendFrom" })
  const fromRenewal = addOneYear(service.renewalDate)
  const fromToday = addOneYear(today)
  const newDate = extendFrom === "today" ? fromToday : fromRenewal
  const stillPast = newDate <= today

  async function onSubmit(values: RenewData) {
    const res = await renewServiceAction(values)
    if (!res.ok) {
      for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
        setError(field as keyof RenewInput, { message })
      }
      toast.error(res.error)
      return
    }
    const date = res.data?.newRenewalDate ?? newDate
    toast.success(`${service.domain} renewed until ${formatDatePK(date)}`)
    onDone(date)
  }

  const err = {
    amount: errors.amount?.message,
    paidOn: errors.paidOn?.message,
    method: errors.method?.message,
    reference: errors.reference?.message,
    notes: errors.notes?.message,
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
      <DialogHeader>
        <DialogTitle>Renew {service.domain}</DialogTitle>
        <DialogDescription>
          Current renewal date: {formatDatePK(service.renewalDate)} (
          {daysLeftText(service.daysLeft)})
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="renew-amount" label="Amount" required error={err.amount}>
          <div className="relative">
            <Input
              id="renew-amount"
              inputMode="decimal"
              autoComplete="off"
              aria-invalid={!!err.amount}
              aria-describedby={fieldDescribedBy("renew-amount", { error: err.amount })}
              className="pr-14 text-right"
              {...register("amount")}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
              {service.currency}
            </span>
          </div>
        </FormField>

        <FormField id="renew-paid-on" label="Paid on" required error={err.paidOn}>
          <Input
            id="renew-paid-on"
            type="date"
            max={addDays(today, 1)}
            aria-invalid={!!err.paidOn}
            aria-describedby={fieldDescribedBy("renew-paid-on", { error: err.paidOn })}
            {...register("paidOn")}
          />
        </FormField>

        <FormField id="renew-method" label="Method" required error={err.method}>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="renew-method"
                  ref={field.ref}
                  onBlur={field.onBlur}
                  aria-invalid={!!err.method}
                  aria-describedby={fieldDescribedBy("renew-method", {
                    error: err.method,
                  })}
                  className="w-full"
                >
                  <SelectValue placeholder="Choose a method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>

        <FormField id="renew-reference" label="Reference" error={err.reference}>
          <Input
            id="renew-reference"
            placeholder="Transaction ID (optional)"
            autoComplete="off"
            aria-invalid={!!err.reference}
            aria-describedby={fieldDescribedBy("renew-reference", {
              error: err.reference,
            })}
            {...register("reference")}
          />
        </FormField>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Extend from</legend>
        <Controller
          control={control}
          name="extendFrom"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="gap-1"
            >
              <Label className="min-h-9 font-normal">
                <RadioGroupItem value="renewal" />
                Current renewal date
                <span className="text-ink-muted">→ {formatDatePK(fromRenewal)}</span>
              </Label>
              <Label className="min-h-9 font-normal">
                <RadioGroupItem value="today" />
                Today
                <span className="text-ink-muted">→ {formatDatePK(fromToday)}</span>
              </Label>
            </RadioGroup>
          )}
        />
        {stillPast && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md bg-orange-bg px-3 py-2.5 text-sm text-orange-fg"
          >
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>
              New date is still in the past.{" "}
              <button
                type="button"
                onClick={() => setValue("extendFrom", "today")}
                className="font-medium underline underline-offset-3 hover:no-underline"
              >
                Extend from today instead
              </button>
            </p>
          </div>
        )}
      </fieldset>

      <FormField id="renew-notes" label="Notes" error={err.notes}>
        <Textarea
          id="renew-notes"
          rows={2}
          className="min-h-16"
          aria-invalid={!!err.notes}
          aria-describedby={fieldDescribedBy("renew-notes", { error: err.notes })}
          {...register("notes")}
        />
      </FormField>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={isSubmitting}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" variant="success" loading={isSubmitting}>
          Renew until {formatDatePK(newDate)}
        </Button>
      </DialogFooter>
    </form>
  )
}
