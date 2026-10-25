"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { Controller, useForm, type FieldValues } from "react-hook-form"
import { toast } from "sonner"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { fieldDescribedBy, FormField } from "@/components/form-field"
import { looseResolver } from "@/components/form-parts"
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
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { WithReason } from "@/components/with-reason"
import { attemptAction } from "@/lib/attempt-action"
import { formatAmount } from "@/lib/domain/money"
import { serviceTypeDeleteBlock } from "@/lib/domain/service-types"
import { serviceTypeSchema, type ServiceTypeInput } from "@/lib/domain/validation"
import { cn } from "@/lib/utils"
import {
  createServiceTypeAction,
  deleteServiceTypeAction,
  setServiceTypeActiveAction,
  updateServiceTypeAction,
} from "@/actions/service-types"
import type { ServiceTypeRow } from "@/types/view"

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`
/** The default price has no currency (docs/14 §2): shown as a plain amount. */
const price = (t: ServiceTypeRow) => (t.defaultPrice ? formatAmount(t.defaultPrice) : "—")

/** The Service Catalog (docs/14 §2): a table, with add/edit in a dialog. */
export function ServiceCatalog({ rows }: { rows: ServiceTypeRow[] }) {
  const [editing, setEditing] = React.useState<ServiceTypeRow | "new" | null>(null)
  const [deleting, setDeleting] = React.useState<ServiceTypeRow | null>(null)
  const [toggling, setToggling] = React.useState<number | null>(null)

  async function toggle(t: ServiceTypeRow, isActive: boolean) {
    setToggling(t.id)
    const res = await attemptAction(() => setServiceTypeActiveAction(t.id, isActive))
    setToggling(null)
    if (!res.ok) return void toast.error(res.error)
    toast.success(isActive ? `${t.name} is active` : `${t.name} is inactive`)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-base text-ink-muted tabular-nums">
          {plural(rows.length, "service")}
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PlusIcon />
          Add service
        </Button>
      </div>

      <section
        aria-label="Service Catalog"
        className="@container overflow-hidden rounded-lg border border-border bg-surface"
      >
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-ink-muted sm:px-5">
            No services yet. Add what you sell, like Web Hosting or AMC.
          </p>
        ) : (
          <>
            <div className="hidden @min-[640px]:block">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">Service</TableHead>
                    <TableHead className="w-32 text-right">Default price</TableHead>
                    <TableHead className="w-32 text-right">Subscriptions</TableHead>
                    <TableHead className="w-28">Active</TableHead>
                    <TableHead className="w-28">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <span
                          className={cn(
                            "block truncate font-medium",
                            !t.isActive && "text-ink-muted"
                          )}
                          title={t.name}
                        >
                          {t.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{price(t)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.usedBy}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={t.isActive}
                          disabled={toggling === t.id}
                          onCheckedChange={(v) => void toggle(t, v)}
                          aria-label={`${t.name} active`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <RowButtons
                          type={t}
                          onEdit={() => setEditing(t)}
                          onDelete={() => setDeleting(t)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="divide-y divide-border @min-[640px]:hidden">
              {rows.map((t) => (
                <li key={t.id} className="flex flex-col gap-3 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate font-medium",
                          !t.isActive && "text-ink-muted"
                        )}
                      >
                        {t.name}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {t.defaultPrice ? `Default ${price(t)} · ` : ""}
                        {plural(t.usedBy, "subscription")}
                      </p>
                    </div>
                    <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm">
                      <Switch
                        checked={t.isActive}
                        disabled={toggling === t.id}
                        onCheckedChange={(v) => void toggle(t, v)}
                        aria-label={`${t.name} active`}
                      />
                      {t.isActive ? "Active" : "Inactive"}
                    </label>
                  </div>
                  <RowButtons
                    type={t}
                    onEdit={() => setEditing(t)}
                    onDelete={() => setDeleting(t)}
                    touch
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-120">
          {editing && (
            <ServiceTypeForm
              key={editing === "new" ? "new" : editing.id}
              type={editing === "new" ? null : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Delete ${deleting.name}?` : ""}
        description="It isn't used by any subscription. This can't be undone."
        confirmLabel="Delete service"
        onConfirm={async () => {
          if (!deleting) return
          const res = await attemptAction(() => deleteServiceTypeAction(deleting.id))
          if (!res.ok) {
            toast.error(res.error)
            return false
          }
          toast.success(`${deleting.name} deleted`)
        }}
      />
    </div>
  )
}

/** Edit, and Delete (disabled with the reason while the type is in use). */
function RowButtons({
  type: t,
  onEdit,
  onDelete,
  touch = false,
}: {
  type: ServiceTypeRow
  onEdit: () => void
  onDelete: () => void
  touch?: boolean
}) {
  const block = serviceTypeDeleteBlock(t.usedBy)
  return (
    <div className={cn("flex justify-end gap-1", touch && "justify-start gap-2")}>
      <Button
        variant="ghost"
        size={touch ? "sm" : "icon-sm"}
        onClick={onEdit}
        aria-label={`Edit ${t.name}`}
        className={cn("text-ink-muted", touch && "h-11")}
      >
        <PencilIcon />
        {touch && "Edit"}
      </Button>
      <WithReason reason={block}>
        <Button
          variant="ghost"
          size={touch ? "sm" : "icon-sm"}
          onClick={onDelete}
          disabled={!!block}
          aria-label={`Delete ${t.name}`}
          className={cn("text-ink-muted", touch && "h-11")}
        >
          <Trash2Icon />
          {touch && "Delete"}
        </Button>
      </WithReason>
    </div>
  )
}

function ServiceTypeForm({
  type,
  onDone,
}: {
  type: ServiceTypeRow | null
  onDone: () => void
}) {
  const form = useForm<FieldValues>({
    resolver: looseResolver(zodResolver(serviceTypeSchema)),
    mode: "onTouched",
    defaultValues: {
      name: type?.name ?? "",
      defaultPrice: type?.defaultPrice ? formatAmount(type.defaultPrice) : "",
      isActive: type?.isActive ?? true,
    } satisfies ServiceTypeInput,
  })
  const {
    register,
    control,
    formState: { errors, isSubmitting },
  } = form
  const nameError = errors.name?.message as string | undefined
  const priceError = errors.defaultPrice?.message as string | undefined

  async function save() {
    const values = form.getValues() as ServiceTypeInput
    const res = type
      ? await attemptAction(() => updateServiceTypeAction(type.id, values))
      : await attemptAction(() => createServiceTypeAction(values))
    if (!res.ok) {
      Object.entries(res.fieldErrors ?? {}).forEach(([name, message], i) =>
        form.setError(name, { message }, { shouldFocus: i === 0 })
      )
      if (!res.fieldErrors) toast.error(res.error)
      return
    }
    toast.success(type ? "Service saved" : `${values.name.trim()} added`)
    onDone()
  }

  return (
    <form onSubmit={form.handleSubmit(save)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{type ? `Edit ${type.name}` : "Add service"}</DialogTitle>
        <DialogDescription>
          {type?.usedBy
            ? `Used by ${plural(type.usedBy, "subscription")}. Renaming changes it on their next invoice.`
            : "What you sell. All services renew yearly."}
        </DialogDescription>
      </DialogHeader>
      <FormField id="service-type-name" label="Name" required error={nameError}>
        <Input
          id="service-type-name"
          autoComplete="off"
          placeholder="e.g. Web Hosting"
          aria-invalid={!!nameError}
          aria-describedby={fieldDescribedBy("service-type-name", { error: nameError })}
          {...register("name")}
        />
      </FormField>
      <FormField
        id="service-type-price"
        label="Default price"
        error={priceError}
        help="Optional. Fills the renewal charge on new subscriptions, in their currency."
      >
        <Input
          id="service-type-price"
          inputMode="decimal"
          autoComplete="off"
          placeholder="6,500"
          aria-invalid={!!priceError}
          aria-describedby={fieldDescribedBy("service-type-price", {
            error: priceError,
            help: true,
          })}
          className="text-right sm:w-48"
          {...register("defaultPrice")}
        />
      </FormField>
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-0.5">
          <label htmlFor="service-type-active" className="text-sm font-medium">
            Active
          </label>
          <p id="service-type-active-help" className="text-xs text-ink-muted">
            Inactive services can&apos;t be picked for new subscriptions.
          </p>
        </div>
        <Controller
          control={control}
          name="isActive"
          render={({ field }) => (
            <Switch
              id="service-type-active"
              ref={field.ref}
              checked={field.value as boolean}
              onCheckedChange={field.onChange}
              aria-describedby="service-type-active-help"
            />
          )}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" loading={isSubmitting}>
          {type ? "Save service" : "Add service"}
        </Button>
      </DialogFooter>
    </form>
  )
}
