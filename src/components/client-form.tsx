"use client"

import { attemptAction } from "@/lib/attempt-action"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, CircleXIcon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"
import {
  Controller,
  FormProvider,
  get,
  useForm,
  useFormContext,
  useWatch,
  type FieldValues,
  type Resolver,
} from "react-hook-form"
import { toast } from "sonner"

import { fieldDescribedBy, FormField } from "@/components/form-field"
import { TimerPill } from "@/components/timer-pill"
import { Button } from "@/components/ui/button"
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
import { addOneYear, formatDatePK, isISODate, todayPK } from "@/lib/domain/dates"
import { normaliseDomain } from "@/lib/domain/hostname"
import {
  clientSchema,
  CURRENCIES,
  newClientSchema,
  serviceSchema,
  startDateWarning,
  type ClientInput,
  type NewClientInput,
  type ServiceInput,
} from "@/lib/domain/validation"
import { formatPhone, normalisePhone } from "@/lib/domain/whatsapp"
import {
  createClientWithServiceAction,
  createServiceAction,
  updateClientAction,
  updateServiceAction,
} from "@/lib/mock/actions"
import { cn } from "@/lib/utils"
import type { ActionResult } from "@/types/actions"

/* Forms --------------------------------------------------------------- */

/**
 * The field groups are shared between forms with different shapes ("client.name"
 * vs "name"), so the forms use string paths and loose FieldValues. The zod
 * schema still validates every value, here and again in the action.
 */
function looseResolver(resolver: unknown): Resolver<FieldValues> {
  return resolver as unknown as Resolver<FieldValues>
}

/** Add client (client + first service) or edit client details (docs/06 §4.6). */
export function ClientForm(
  props:
    | { mode: "new"; defaultValues: NewClientInput }
    | { mode: "edit"; clientId: number; defaultValues: ClientInput }
) {
  const isNew = props.mode === "new"
  const form = useForm<FieldValues>({
    resolver: looseResolver(
      isNew ? zodResolver(newClientSchema) : zodResolver(clientSchema)
    ),
    mode: "onTouched",
    defaultValues: props.defaultValues,
  })

  async function save() {
    // Send the raw values; the action validates (and normalises) them again.
    const values = form.getValues()
    const res = isNew
      ? await attemptAction(() => createClientWithServiceAction(values as NewClientInput))
      : await attemptAction(() => updateClientAction(props.clientId, values as ClientInput))
    handleFailure(res, form.setError)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save)} noValidate>
        <Section
          title="Client details"
          description="Who the reminders go to. Add an email, a WhatsApp number, or both."
        >
          <ClientFields prefix={isNew ? "client." : ""} />
        </Section>
        {isNew && (
          <Section
            title="Hosting service"
            description="The domain and its yearly renewal. You can add more services later."
          >
            <ServiceFields prefix="service." />
          </Section>
        )}
        <FormActions
          cancelHref={isNew ? "/clients" : `/clients/${props.clientId}`}
          submitLabel={isNew ? "Save client" : "Save changes"}
        />
      </form>
    </FormProvider>
  )
}

/** Add or edit a single hosting service. */
export function ServiceForm(
  props:
    | { mode: "new"; clientId: number; defaultValues: ServiceInput }
    | { mode: "edit"; serviceId: number; clientId: number; defaultValues: ServiceInput }
) {
  const form = useForm<FieldValues>({
    resolver: looseResolver(zodResolver(serviceSchema)),
    mode: "onTouched",
    defaultValues: props.defaultValues,
  })

  async function save() {
    const values = form.getValues() as ServiceInput
    const res =
      props.mode === "new"
        ? await attemptAction(() => createServiceAction(props.clientId, values))
        : await attemptAction(() => updateServiceAction(props.serviceId, values))
    handleFailure(res, form.setError)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save)} noValidate>
        <Section
          title="Hosting service"
          description="The domain and its yearly renewal. Renewal dates default to one year after the start."
        >
          <ServiceFields prefix="" autoRenewal={props.mode === "new"} />
        </Section>
        <FormActions
          cancelHref={`/clients/${props.clientId}`}
          submitLabel={props.mode === "new" ? "Add service" : "Save service"}
        />
      </form>
    </FormProvider>
  )
}

/** Successful saves redirect on the server; this only runs when they don't. */
function handleFailure(
  res: ActionResult | undefined,
  setError: ReturnType<typeof useForm>["setError"]
) {
  if (!res || res.ok) return
  const fields = Object.entries(res.fieldErrors ?? {})
  fields.forEach(([name, message], i) =>
    setError(name, { message }, { shouldFocus: i === 0 })
  )
  toast.error(res.error)
}

/* Layout -------------------------------------------------------------- */

/** Settings-style section: title + one line on the left (1/3), fields on the right (2/3). */
function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 border-b border-border pb-6 not-first:pt-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] xl:gap-8">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 max-w-xs text-sm text-ink-muted">{description}</p>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
        {children}
      </div>
    </section>
  )
}

/** Desktop: right-aligned under the form. Mobile: a sticky bar above the bottom nav. */
function FormActions({
  cancelHref,
  submitLabel,
}: {
  cancelHref: string
  submitLabel: string
}) {
  const {
    formState: { isSubmitting },
  } = useFormContext()
  return (
    <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 flex gap-2 border-t border-border bg-surface px-4 py-3 sm:-mx-6 sm:px-6 md:static md:mx-0 md:justify-end md:border-0 md:bg-transparent md:p-0">
      <Button asChild variant="outline" className="flex-1 max-md:h-11 md:flex-none">
        <Link href={cancelHref}>Cancel</Link>
      </Button>
      <Button
        type="submit"
        loading={isSubmitting}
        className="flex-1 max-md:h-11 md:flex-none"
      >
        {submitLabel}
      </Button>
    </div>
  )
}

/* Field groups -------------------------------------------------------- */

function useField(prefix: string, key: string) {
  const {
    formState: { errors },
  } = useFormContext()
  const name = `${prefix}${key}`
  const id = name.replace(/\./g, "-")
  const error = get(errors, name)?.message as string | undefined
  return { name, id, error }
}

function ClientFields({ prefix }: { prefix: string }) {
  const { register, control } = useFormContext()
  const name = useField(prefix, "name")
  const company = useField(prefix, "company")
  const email = useField(prefix, "email")
  const phone = useField(prefix, "phone")
  const notes = useField(prefix, "notes")
  const phoneValue = (useWatch({ control, name: phone.name }) as string | undefined) ?? ""

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField
        id={name.id}
        label="Name"
        required
        error={name.error}
        className="sm:col-span-2"
      >
        <Input
          id={name.id}
          autoComplete="off"
          placeholder="Person or business name"
          aria-invalid={!!name.error}
          aria-describedby={fieldDescribedBy(name.id, { error: name.error })}
          {...register(name.name)}
        />
      </FormField>
      <FormField
        id={company.id}
        label="Company"
        error={company.error}
        className="sm:col-span-2"
      >
        <Input
          id={company.id}
          autoComplete="off"
          placeholder="Optional"
          aria-invalid={!!company.error}
          aria-describedby={fieldDescribedBy(company.id, { error: company.error })}
          {...register(company.name)}
        />
      </FormField>
      <FormField id={email.id} label="Email" error={email.error}>
        <Input
          id={email.id}
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="name@business.pk"
          aria-invalid={!!email.error}
          aria-describedby={fieldDescribedBy(email.id, { error: email.error })}
          {...register(email.name)}
        />
      </FormField>
      <FormField
        id={phone.id}
        label="WhatsApp phone"
        error={phone.error}
        help={<PhonePreview value={phoneValue} />}
      >
        <Input
          id={phone.id}
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="03001234567 or +923001234567"
          aria-invalid={!!phone.error}
          aria-describedby={fieldDescribedBy(phone.id, {
            error: phone.error,
            help: true,
          })}
          {...register(phone.name)}
        />
      </FormField>
      <FormField
        id={notes.id}
        label="Notes"
        error={notes.error}
        className="sm:col-span-2"
      >
        <Textarea
          id={notes.id}
          rows={3}
          placeholder="Anything worth remembering about this client"
          aria-invalid={!!notes.error}
          aria-describedby={fieldDescribedBy(notes.id, { error: notes.error })}
          {...register(notes.name)}
        />
      </FormField>
    </div>
  )
}

/** Live "WhatsApp: +92 300 1234567 ✓" preview (docs/06 §3.5). */
function PhonePreview({ value }: { value: string }) {
  const trimmed = value.trim()
  if (!trimmed) return <>Used for WhatsApp reminders.</>
  const digits = normalisePhone(trimmed)
  if (digits) {
    return (
      <span className="inline-flex items-center gap-1">
        WhatsApp: <span className="text-ink tabular-nums">{formatPhone(digits)}</span>
        <CheckIcon aria-label="valid" className="size-3.5 text-green-fg" />
      </span>
    )
  }
  // Don't complain while the first few digits are still being typed.
  if (trimmed.replace(/\D/g, "").length < 7) return <>Keep typing the number.</>
  return (
    <span className="inline-flex items-center gap-1 text-red-fg">
      <CircleXIcon aria-hidden className="size-3.5" />
      Not a valid WhatsApp number
    </span>
  )
}

function ServiceFields({
  prefix,
  autoRenewal = true,
}: {
  prefix: string
  autoRenewal?: boolean
}) {
  const { register, control, setValue, getValues, formState } = useFormContext()
  const domain = useField(prefix, "domain")
  const plan = useField(prefix, "planLabel")
  const start = useField(prefix, "startDate")
  const renewal = useField(prefix, "renewalDate")
  const charge = useField(prefix, "chargeAmount")
  const currency = useField(prefix, "currency")
  const reminders = useField(prefix, "remindersEnabled")
  const notes = useField(prefix, "notes")

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
      setValue(renewal.name, addOneYear(s), {
        shouldDirty: true,
        shouldValidate: formState.isSubmitted,
      })
    }
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField id={domain.id} label="Domain" required error={domain.error}>
        <Input
          id={domain.id}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="noordental.pk"
          aria-invalid={!!domain.error}
          aria-describedby={fieldDescribedBy(domain.id, { error: domain.error })}
          {...register(domain.name, {
            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
              const clean = normaliseDomain(e.target.value)
              if (clean !== e.target.value)
                setValue(domain.name, clean, { shouldValidate: true })
            },
          })}
        />
      </FormField>
      <FormField id={plan.id} label="Plan" error={plan.error}>
        <Input
          id={plan.id}
          autoComplete="off"
          placeholder="e.g. Business"
          aria-invalid={!!plan.error}
          aria-describedby={fieldDescribedBy(plan.id, { error: plan.error })}
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
        label="Yearly charge"
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
                  ref={field.ref}
                  aria-label="Currency"
                  className="-ml-px w-24 shrink-0 rounded-l-none bg-surface-hover focus-visible:z-10"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
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
            Email and WhatsApp reminders before this service renews.
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
        label="Service notes"
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
