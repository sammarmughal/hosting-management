"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  type FieldValues,
} from "react-hook-form"

import { fieldDescribedBy, FormField } from "@/components/form-field"
import {
  ContactFields,
  FormActions,
  handleFailure,
  looseResolver,
  Section,
  useField,
} from "@/components/form-parts"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { attemptAction } from "@/lib/attempt-action"
import { currencyLabel } from "@/lib/domain/currency"
import { clientSchema, type ClientInput } from "@/lib/domain/validation"
import { createClientAction, updateClientAction } from "@/actions/clients"

const ID = "client-"

/**
 * Add or edit a client: customer info only (docs/14 §0). Companies and
 * subscriptions are added from the client's page.
 */
export function ClientForm(
  props: (
    | { mode: "new"; defaultValues: ClientInput }
    | { mode: "edit"; clientId: number; defaultValues: ClientInput }
  ) & { currencies: readonly string[] }
) {
  const form = useForm<FieldValues>({
    resolver: looseResolver(zodResolver(clientSchema)),
    mode: "onTouched",
    defaultValues: props.defaultValues,
  })

  async function save() {
    // Send the raw values; the action validates (and normalises) them again.
    const values = form.getValues() as ClientInput
    const res =
      props.mode === "new"
        ? await attemptAction(() => createClientAction(values))
        : await attemptAction(() => updateClientAction(props.clientId, values))
    handleFailure(res, form.setError)
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save)} noValidate>
        <Section
          title="Client details"
          description="The customer who pays. Reminders go to this email and WhatsApp number."
        >
          <ClientFields currencies={props.currencies} />
        </Section>
        <FormActions
          cancelHref={props.mode === "new" ? "/clients" : `/clients/${props.clientId}`}
          submitLabel={props.mode === "new" ? "Save client" : "Save changes"}
        />
      </form>
    </FormProvider>
  )
}

function ClientFields({ currencies }: { currencies: readonly string[] }) {
  const { register, control } = useFormContext()
  const name = useField("name", ID)
  const address = useField("address", ID)
  const currency = useField("currency", ID)
  const notes = useField("notes", ID)

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
      <ContactFields idPrefix={ID} />
      <FormField
        id={address.id}
        label="Billing address"
        error={address.error}
        help="Optional. Printed on invoices under the client’s name."
        className="sm:col-span-2"
      >
        <Textarea
          id={address.id}
          rows={2}
          placeholder="Street, area, city"
          aria-invalid={!!address.error}
          aria-describedby={fieldDescribedBy(address.id, {
            error: address.error,
            help: true,
          })}
          {...register(address.name)}
        />
      </FormField>
      <FormField
        id={currency.id}
        label="Default currency"
        required
        error={currency.error}
        help="New subscriptions for this client start in it."
        className="sm:col-span-2"
      >
        <Controller
          control={control}
          name={currency.name}
          render={({ field }) => (
            <Select value={field.value as string} onValueChange={field.onChange}>
              <SelectTrigger
                id={currency.id}
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={!!currency.error}
                aria-describedby={fieldDescribedBy(currency.id, {
                  error: currency.error,
                  help: true,
                })}
                className="w-full sm:w-80"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((c) => (
                  <SelectItem key={c} value={c}>
                    {currencyLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
