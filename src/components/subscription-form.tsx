"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { TriangleAlertIcon } from "lucide-react"
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
  type FieldValues,
} from "react-hook-form"

import { fieldDescribedBy, FormField } from "@/components/form-field"
import {
  FormActions,
  handleFailure,
  looseResolver,
  Section,
  useField,
} from "@/components/form-parts"
import { TimerPill } from "@/components/timer-pill"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { attemptAction } from "@/lib/attempt-action"
import { currencyOptions } from "@/lib/domain/currency"
import { nextRenewal } from "@/lib/domain/cycles"
import { formatDatePK, isISODate, todayPK } from "@/lib/domain/dates"
import { normaliseIdentifier } from "@/lib/domain/hostname"
import { plainAmount } from "@/lib/domain/money"
import {
  startDateWarning,
  subscriptionSchema,
  type SubscriptionInput,
} from "@/lib/domain/validation"
import { cn } from "@/lib/utils"
import {
  createSubscriptionAction,
  updateSubscriptionAction,
} from "@/actions/subscriptions"
import type { Option } from "@/types/view"

const ID = "subscription-"
/** Radix Select items can't have an empty value. */
const NO_COMPANY = "none"

export interface SubscriptionFormOptions {
  clients: (Option & { currency: string })[]
  companies: (Option & { clientId: number; name: string })[]
  /** Active types, plus the subscription's own one when editing. */
  serviceTypes: { id: number; name: string; defaultPrice: string | null }[]
  /** Enabled currencies (the subscription's current one is added when editing). */
  enabledCurrencies: readonly string[]
}

/** Add or edit a subscription (docs/14 §4). */
export function SubscriptionForm(
  props: (
    | { mode: "new"; defaultValues: SubscriptionInput }
    | { mode: "edit"; subscriptionId: number; defaultValues: SubscriptionInput }
  ) & { options: SubscriptionFormOptions; cancelHref: string }
) {
  const form = useForm<FieldValues>({
    resolver: looseResolver(zodResolver(subscriptionSchema)),
    mode: "onTouched",
    defaultValues: props.defaultValues,
  })

  async function save() {
    const values = form.getValues() as SubscriptionInput
    const res =
      props.mode === "new"
        ? await attemptAction(() => createSubscriptionAction(values))
        : await attemptAction(() =>
            updateSubscriptionAction(props.subscriptionId, values)
          )
    handleFailure(res, form.setError)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save)} noValidate>
        <Section
          title="Who it's for"
          description="The client pays and gets the reminders. Pick a company when it's for one of their businesses."
        >
          <OwnerFields options={props.options} />
        </Section>
        <Section
          title="Subscription"
          description="What renews, and when. Billing is yearly; the renewal date defaults to one year after the start."
        >
          <SubscriptionFields
            options={props.options}
            autoRenewal={props.mode === "new"}
            currentCurrency={
              props.mode === "edit" ? props.defaultValues.currency : undefined
            }
          />
        </Section>
        <FormActions
          cancelHref={props.cancelHref}
          submitLabel={props.mode === "new" ? "Add subscription" : "Save subscription"}
        />
      </form>
    </FormProvider>
  )
}

function OwnerFields({ options }: { options: SubscriptionFormOptions }) {
  const { control, setValue } = useFormContext()
  const client = useField("clientId", ID)
  const company = useField("companyId", ID)
  const clientId = Number(useWatch({ control, name: client.name })) || 0
  const companies = options.companies.filter((c) => c.clientId === clientId)

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField id={client.id} label="Client" required error={client.error}>
        <Controller
          control={control}
          name={client.name}
          render={({ field }) => (
            <Select
              value={field.value ? String(field.value) : ""}
              onValueChange={(v) => {
                field.onChange(v)
                // docs/14 §4: a new client clears the company and brings its currency.
                setValue(company.name, "")
                const c = options.clients.find((x) => String(x.id) === v)
                if (c) setValue("currency", c.currency, { shouldDirty: true })
              }}
            >
              <SelectTrigger
                id={client.id}
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={!!client.error}
                aria-describedby={fieldDescribedBy(client.id, { error: client.error })}
                className="w-full"
              >
                <SelectValue placeholder="Choose the client" />
              </SelectTrigger>
              <SelectContent>
                {options.clients.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      <FormField
        id={company.id}
        label="Company"
        error={company.error}
        help={
          clientId && companies.length === 0
            ? "This client has no companies yet."
            : "Optional. Shown on the invoice under the client."
        }
      >
        <Controller
          control={control}
          name={company.name}
          render={({ field }) => (
            <Select
              value={field.value ? String(field.value) : NO_COMPANY}
              onValueChange={(v) => field.onChange(v === NO_COMPANY ? "" : v)}
              disabled={!clientId || companies.length === 0}
            >
              <SelectTrigger
                id={company.id}
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={!!company.error}
                aria-describedby={fieldDescribedBy(company.id, {
                  error: company.error,
                  help: true,
                })}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COMPANY}>No company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
    </div>
  )
}

function SubscriptionFields({
  options,
  autoRenewal,
  currentCurrency,
}: {
  options: SubscriptionFormOptions
  autoRenewal: boolean
  currentCurrency?: string
}) {
  const { register, control, setValue, getValues, formState } = useFormContext()
  const type = useField("serviceTypeId", ID)
  const domain = useField("domain", ID)
  const plan = useField("planLabel", ID)
  const start = useField("startDate", ID)
  const renewal = useField("renewalDate", ID)
  const charge = useField("chargeAmount", ID)
  const currency = useField("currency", ID)
  const reminders = useField("remindersEnabled", ID)
  const notes = useField("notes", ID)
  const currencies = currencyOptions(options.enabledCurrencies, currentCurrency)

  // Renewal follows start + 1 year until the user edits it (docs/06 §4.6).
  const [manual, setManual] = React.useState(!autoRenewal)
  const [today] = React.useState(() => todayPK())
  const startValue = (useWatch({ control, name: start.name }) as string | undefined) ?? ""
  const renewalValue =
    (useWatch({ control, name: renewal.name }) as string | undefined) ?? ""
  const startWarning = startDateWarning(startValue, today)
  const preview =
    isISODate(renewalValue) && (!isISODate(startValue) || renewalValue > startValue)
      ? renewalValue
      : null

  function applyAuto() {
    const s = getValues(start.name) as string
    if (isISODate(s)) {
      setValue(renewal.name, nextRenewal(s), {
        shouldDirty: true,
        shouldValidate: formState.isSubmitted,
      })
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField id={type.id} label="Service" required error={type.error}>
        <Controller
          control={control}
          name={type.name}
          render={({ field }) => (
            <Select
              value={field.value ? String(field.value) : ""}
              onValueChange={(v) => {
                field.onChange(v)
                // The catalog's default price fills an empty charge (docs/14 §4).
                const t = options.serviceTypes.find((x) => String(x.id) === v)
                const amount = String(getValues(charge.name) ?? "").trim()
                if (t?.defaultPrice && !amount)
                  setValue(
                    charge.name,
                    plainAmount(t.defaultPrice, String(getValues(currency.name))),
                    { shouldDirty: true }
                  )
              }}
            >
              <SelectTrigger
                id={type.id}
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={!!type.error}
                aria-describedby={fieldDescribedBy(type.id, { error: type.error })}
                className="w-full"
              >
                <SelectValue placeholder="Choose the service" />
              </SelectTrigger>
              <SelectContent>
                {options.serviceTypes.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>
      <FormField
        id={domain.id}
        label="Domain / identifier"
        required
        error={domain.error}
        help="A domain, or another name for what renews."
      >
        <Input
          id={domain.id}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="noordental.pk"
          aria-invalid={!!domain.error}
          aria-describedby={fieldDescribedBy(domain.id, {
            error: domain.error,
            help: true,
          })}
          {...register(domain.name, {
            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
              const clean = normaliseIdentifier(e.target.value)
              if (clean !== e.target.value)
                setValue(domain.name, clean, { shouldValidate: true })
            },
          })}
        />
      </FormField>
      <FormField
        id={plan.id}
        label="Hosting plan"
        error={plan.error}
        className="sm:col-span-2"
      >
        <Input
          id={plan.id}
          autoComplete="off"
          placeholder="Optional, e.g. Business"
          aria-invalid={!!plan.error}
          aria-describedby={fieldDescribedBy(plan.id, { error: plan.error })}
          className="sm:w-80"
          {...register(plan.name)}
        />
      </FormField>

      <FormField
        id={start.id}
        label="Start date"
        required
        error={start.error}
        help={
          startWarning ? (
            <span className="inline-flex items-center gap-1 text-orange-fg">
              <TriangleAlertIcon aria-hidden className="size-3.5" />
              {startWarning}
            </span>
          ) : undefined
        }
      >
        <Input
          id={start.id}
          type="date"
          aria-invalid={!!start.error}
          aria-describedby={fieldDescribedBy(start.id, {
            error: start.error,
            help: startWarning,
          })}
          {...register(start.name, { onChange: () => !manual && applyAuto() })}
        />
      </FormField>
      <FormField
        id={renewal.id}
        label="Renewal date"
        required
        error={renewal.error}
        help={
          manual ? (
            <>
              Set by hand.{" "}
              <button
                type="button"
                onClick={() => {
                  setManual(false)
                  applyAuto()
                }}
                className="inline-flex min-h-11 items-center font-medium text-brand-700 hover:underline"
              >
                Reset
              </button>{" "}
              to start date + 1 year
            </>
          ) : (
            "Auto: start date + 1 year"
          )
        }
      >
        <Input
          id={renewal.id}
          type="date"
          aria-invalid={!!renewal.error}
          aria-describedby={fieldDescribedBy(renewal.id, {
            error: renewal.error,
            help: true,
          })}
          {...register(renewal.name, { onChange: () => setManual(true) })}
        />
      </FormField>

      <div
        className={cn(
          "flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-surface-hover px-3 py-2 text-sm text-ink-muted sm:col-span-2",
          !preview && "text-ink-subtle"
        )}
        aria-live="polite"
      >
        {preview ? (
          <>
            <TimerPill renewalDate={preview} />
            <span>Renews {formatDatePK(preview)}</span>
          </>
        ) : (
          "Enter a renewal date after the start date to see the timer."
        )}
      </div>

      <FormField
        id={charge.id}
        label="Renewal charge"
        required
        error={charge.error ?? currency.error}
      >
        <div className="flex">
          <Input
            id={charge.id}
            inputMode="decimal"
            autoComplete="off"
            placeholder="6,500"
            aria-invalid={!!charge.error}
            aria-describedby={fieldDescribedBy(charge.id, {
              error: charge.error ?? currency.error,
            })}
            className="min-w-0 flex-1 rounded-r-none text-right focus-visible:z-10"
            {...register(charge.name)}
          />
          <Controller
            control={control}
            name={currency.name}
            render={({ field }) => (
              <Select value={field.value as string} onValueChange={field.onChange}>
                <SelectTrigger
                  id={currency.id}
                  ref={field.ref}
                  aria-label="Currency"
                  className="-ml-px w-24 shrink-0 rounded-l-none bg-surface-hover focus-visible:z-10"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </FormField>

      <div className="flex items-start justify-between gap-4 sm:pt-6">
        <div className="grid gap-0.5">
          <label htmlFor={reminders.id} className="text-sm font-medium">
            Send reminders
          </label>
          <p id={`${reminders.id}-help`} className="text-xs text-ink-muted">
            Email and WhatsApp reminders to the client before it renews.
          </p>
        </div>
        <Controller
          control={control}
          name={reminders.name}
          render={({ field }) => (
            <Switch
              id={reminders.id}
              ref={field.ref}
              checked={field.value as boolean}
              onCheckedChange={field.onChange}
              aria-describedby={`${reminders.id}-help`}
            />
          )}
        />
      </div>

      <FormField
        id={notes.id}
        label="Notes"
        error={notes.error}
        className="sm:col-span-2"
      >
        <Textarea
          id={notes.id}
          rows={2}
          placeholder="Optional"
          aria-invalid={!!notes.error}
          aria-describedby={fieldDescribedBy(notes.id, { error: notes.error })}
          {...register(notes.name)}
        />
      </FormField>
    </div>
  )
}
