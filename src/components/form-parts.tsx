"use client"

import * as React from "react"
import { CheckIcon, CircleXIcon } from "lucide-react"
import Link from "next/link"
import {
  get,
  useFormContext,
  useWatch,
  type FieldValues,
  type Resolver,
  type UseFormSetError,
} from "react-hook-form"
import { toast } from "sonner"

import { fieldDescribedBy, FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatPhone, normalisePhone } from "@/lib/domain/whatsapp"
import type { ActionResult } from "@/types/actions"

// Pieces shared by the client, company and subscription forms (docs/06 §3.5).

/**
 * The zod schemas transform values (ids, nulls), so their input and output
 * types differ; the forms use loose FieldValues. The schema still validates
 * every value, here and again in the action.
 */
export function looseResolver(resolver: unknown): Resolver<FieldValues> {
  return resolver as unknown as Resolver<FieldValues>
}

/** Successful saves redirect on the server; this only runs when they don't. */
export function handleFailure(
  res: ActionResult | undefined,
  setError: UseFormSetError<FieldValues>
) {
  if (!res || res.ok) return
  const fields = Object.entries(res.fieldErrors ?? {})
  fields.forEach(([name, message], i) =>
    setError(name, { message }, { shouldFocus: i === 0 })
  )
  toast.error(res.error)
}

/** Settings-style section: title + one line on the left (1/3), fields on the right (2/3). */
export function Section({
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
export function FormActions({
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

/** A field's form name, element id (`${idPrefix}${key}`) and error. */
export function useField(key: string, idPrefix: string) {
  const {
    formState: { errors },
  } = useFormContext()
  const error = get(errors, key)?.message as string | undefined
  return { name: key, id: `${idPrefix}${key}`, error }
}

/** Email + WhatsApp phone, with the live phone preview (clients and companies). */
export function ContactFields({
  idPrefix,
  phoneLabel = "WhatsApp phone",
  phoneHelp = "Used for WhatsApp reminders.",
}: {
  idPrefix: string
  phoneLabel?: string
  phoneHelp?: string
}) {
  const { register, control } = useFormContext()
  const email = useField("email", idPrefix)
  const phone = useField("phone", idPrefix)
  const phoneValue = (useWatch({ control, name: phone.name }) as string | undefined) ?? ""
  return (
    <>
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
        label={phoneLabel}
        error={phone.error}
        help={<PhonePreview value={phoneValue} empty={phoneHelp} />}
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
    </>
  )
}

/** Live "WhatsApp: +92 300 1234567 ✓" preview (docs/06 §3.5). */
function PhonePreview({ value, empty }: { value: string; empty: string }) {
  const trimmed = value.trim()
  if (!trimmed) return <>{empty}</>
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
