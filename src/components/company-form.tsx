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
import { companySchema, type CompanyInput } from "@/lib/domain/validation"
import { createCompanyAction, updateCompanyAction } from "@/actions/companies"
import type { Option } from "@/types/view"

const ID = "company-"

/** Add or edit a company (docs/14 §3). `from` is where Save and Cancel return to. */
export function CompanyForm(
  props: (
    | { mode: "new"; defaultValues: CompanyInput }
    | { mode: "edit"; companyId: number; defaultValues: CompanyInput }
  ) & { clients: Option[]; from: "companies" | "client" }
) {
  const form = useForm<FieldValues>({
    resolver: looseResolver(zodResolver(companySchema)),
    mode: "onTouched",
    defaultValues: props.defaultValues,
  })

  async function save() {
    const values = form.getValues() as CompanyInput
    const res =
      props.mode === "new"
        ? await attemptAction(() => createCompanyAction(values, props.from))
        : await attemptAction(() =>
            updateCompanyAction(props.companyId, values, props.from)
          )
    handleFailure(res, form.setError)
  }

  const clientId = Number(props.defaultValues.clientId) || 0
  const cancelHref =
    props.from === "client" && clientId
      ? `/clients/${clientId}?tab=companies`
      : "/companies"

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(save)} noValidate>
        <Section
          title="Company"
          description="A business the client pays for. Its details are printed on invoices; reminders still go to the client."
        >
          <CompanyFields clients={props.clients} lockClient={props.mode === "edit"} />
        </Section>
        <FormActions
          cancelHref={cancelHref}
          submitLabel={props.mode === "new" ? "Save company" : "Save changes"}
        />
      </form>
    </FormProvider>
  )
}

function CompanyFields({
  clients,
  lockClient,
}: {
  clients: Option[]
  lockClient: boolean
}) {
  const { register, control } = useFormContext()
  const client = useField("clientId", ID)
  const name = useField("name", ID)
  const address = useField("address", ID)

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <FormField
        id={client.id}
        label="Client"
        required
        error={client.error}
        help={lockClient ? "A company stays with its client." : undefined}
        className="sm:col-span-2"
      >
        <Controller
          control={control}
          name={client.name}
          render={({ field }) => (
            <Select
              value={field.value ? String(field.value) : ""}
              onValueChange={field.onChange}
              disabled={lockClient}
            >
              <SelectTrigger
                id={client.id}
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={!!client.error}
                aria-describedby={fieldDescribedBy(client.id, {
                  error: client.error,
                  help: lockClient,
                })}
                className="w-full sm:w-96"
              >
                <SelectValue placeholder="Choose the client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
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
        id={name.id}
        label="Company name"
        required
        error={name.error}
        className="sm:col-span-2"
      >
        <Input
          id={name.id}
          autoComplete="off"
          placeholder="e.g. Noor Dental Clinic"
          aria-invalid={!!name.error}
          aria-describedby={fieldDescribedBy(name.id, { error: name.error })}
          {...register(name.name)}
        />
      </FormField>
      <ContactFields
        idPrefix={ID}
        phoneLabel="Phone"
        phoneHelp="Optional. Printed on invoices."
      />
      <FormField
        id={address.id}
        label="Billing address"
        error={address.error}
        help="Optional. Printed on invoices under the company name."
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
    </div>
  )
}
