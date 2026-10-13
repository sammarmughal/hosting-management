"use client"

import * as React from "react"
import { ImageIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { FormField } from "@/components/form-field"
import { PaymentAccountsEditor } from "@/components/settings/payment-accounts"
import {
  SettingInput,
  SettingsSection,
  SettingToggle,
} from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { formatInvoiceNumber, LEAD_DAY_CHOICES } from "@/lib/domain/invoices"
import {
  invoiceSettingsSchema,
  LOGO_MAX_CHARS,
  LOGO_RE,
  type InvoiceSettings,
} from "@/lib/domain/preferences"

const MAX_LOGO_BYTES = 200 * 1024

/** Settings → Invoices (docs/13 §11). */
export function InvoiceSettingsForm({
  initial,
  invoiceCount,
  year,
  currencies,
}: {
  initial: InvoiceSettings
  /** The next number can only be set before the first invoice exists. */
  invoiceCount: number
  year: number
  /** Enabled currencies, offered on the payment accounts. */
  currencies: string[]
}) {
  return (
    <>
      <SettingsSection
        title="Invoices"
        description="How invoices are numbered and when they’re created before a renewal."
        section="invoices"
        initial={initial}
        validate={(draft) => {
          const r = invoiceSettingsSchema.safeParse(draft)
          return r.success ? undefined : r.error.issues[0]?.message
        }}
      >
        {(draft, update) => (
          <InvoiceFields
            draft={draft}
            update={update}
            locked={invoiceCount > 0}
            year={year}
            currencies={currencies}
          />
        )}
      </SettingsSection>
    </>
  )
}

function InvoiceFields({
  draft,
  update,
  locked,
  year,
  currencies,
}: {
  draft: InvoiceSettings
  update: (patch: Partial<InvoiceSettings>) => void
  locked: boolean
  year: number
  currencies: string[]
}) {
  const preset = (LEAD_DAY_CHOICES as readonly number[]).includes(draft.leadDays)
  const [custom, setCustom] = React.useState(!preset)
  const [logoError, setLogoError] = React.useState("")
  const fileRef = React.useRef<HTMLInputElement>(null)

  let example = ""
  try {
    example = formatInvoiceNumber(draft.prefix.trim().toUpperCase() || "INV", year, draft.nextNumber || 1)
  } catch {
    example = ""
  }

  function pickLogo(file: File | undefined) {
    setLogoError("")
    if (!file) return
    if (file.type !== "image/png" && file.type !== "image/jpeg")
      return setLogoError("Upload a PNG or JPEG file.")
    if (file.size > MAX_LOGO_BYTES) return setLogoError("Use a logo under 200 KB.")
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result ?? "")
      if (!LOGO_RE.test(url) || url.length > LOGO_MAX_CHARS)
        return setLogoError("This image can’t be used. Try a PNG or JPEG under 200 KB.")
      update({ logo: url })
    }
    reader.readAsDataURL(file)
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="invoice-prefix"
          label="Number prefix"
          help={example ? `Next invoice: ${example}` : "1–10 letters or digits"}
        >
          <Input
            id="invoice-prefix"
            value={draft.prefix}
            maxLength={10}
            onChange={(e) => update({ prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })}
            aria-describedby="invoice-prefix-help"
            className="font-mono uppercase"
          />
        </FormField>
        <FormField
          id="invoice-next"
          label={`Next number in ${year}`}
          help={locked ? "Set automatically once invoices exist." : "Start from a later number if needed."}
        >
          <Input
            id="invoice-next"
            type="number"
            min={1}
            value={draft.nextNumber}
            disabled={locked}
            onChange={(e) => update({ nextNumber: Number(e.target.value) || 1 })}
            aria-describedby="invoice-next-help"
            className="tabular-nums"
          />
        </FormField>
      </div>

      <FormField id="lead-15" label="Create invoices">
        <RadioGroup
          value={custom ? "custom" : String(draft.leadDays)}
          onValueChange={(v) => {
            if (v === "custom") return setCustom(true)
            setCustom(false)
            update({ leadDays: Number(v) })
          }}
          className="flex flex-wrap gap-x-5 gap-y-1"
        >
          {LEAD_DAY_CHOICES.map((d) => (
            <label key={d} className="flex min-h-11 items-center gap-2 text-sm md:min-h-9">
              <RadioGroupItem id={`lead-${d}`} value={String(d)} />
              {d} days before renewal
            </label>
          ))}
          <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9">
            <RadioGroupItem value="custom" />
            Custom
          </label>
        </RadioGroup>
      </FormField>
      {custom && (
        <SettingInput
          id="lead-custom"
          label="Days before renewal"
          type="number"
          min={1}
          max={120}
          value={draft.leadDays}
          onChange={(v) => update({ leadDays: Number(v) })}
        />
      )}

      <FormField id="invoice-logo" label="Logo" help="PNG or JPEG, under 200 KB. Printed on invoices." error={logoError}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-12 w-28 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
            {draft.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logo} alt="Current logo" className="max-h-10 max-w-24 object-contain" />
            ) : (
              <ImageIcon aria-hidden className="size-5 text-ink-subtle" />
            )}
          </div>
          <input
            ref={fileRef}
            id="invoice-logo"
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={(e) => {
              pickLogo(e.target.files?.[0])
              e.target.value = ""
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <UploadIcon />
            {draft.logo ? "Replace logo" : "Upload logo"}
          </Button>
          {draft.logo && (
            <Button type="button" variant="ghost" size="sm" className="text-ink-muted" onClick={() => update({ logo: "" })}>
              <Trash2Icon />
              Remove
            </Button>
          )}
        </div>
      </FormField>

      <FormField id="business-address" label="Business address" help="Printed under your business name.">
        <Textarea
          id="business-address"
          rows={2}
          value={draft.address}
          maxLength={300}
          onChange={(e) => update({ address: e.target.value })}
          aria-describedby="business-address-help"
        />
      </FormField>
      <SettingInput
        id="invoice-ntn"
        label="NTN"
        required={false}
        help="Optional. Your National Tax Number."
        value={draft.ntn}
        onChange={(ntn) => update({ ntn })}
      />

      <PaymentAccountsEditor
        accounts={draft.accounts}
        currencies={currencies}
        onChange={(accounts) => update({ accounts })}
      />
      <SettingInput
        id="pay-wallet"
        label="JazzCash / Easypaisa number"
        required={false}
        help="Optional. Printed on PKR invoices only: JazzCash and Easypaisa take rupees."
        value={draft.wallet}
        onChange={(wallet) => update({ wallet })}
      />

      <FormField id="invoice-footer" label="Footer note">
        <Textarea
          id="invoice-footer"
          rows={2}
          value={draft.footer}
          maxLength={500}
          onChange={(e) => update({ footer: e.target.value })}
        />
      </FormField>

      <SettingToggle
        id="tax-enabled"
        label="Add tax"
        help="Applied to new invoices, after any discount."
        checked={draft.taxEnabled}
        onChange={(taxEnabled) => update({ taxEnabled })}
      />
      {draft.taxEnabled && (
        <SettingInput
          id="tax-rate"
          label="Tax rate (%)"
          value={draft.taxRate}
          onChange={(taxRate) => update({ taxRate: taxRate.replace(/[^\d.]/g, "") })}
        />
      )}
    </>
  )
}
