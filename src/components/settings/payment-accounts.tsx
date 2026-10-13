"use client"

import { PlusIcon, StarIcon, Trash2Icon } from "lucide-react"

import { fieldDescribedBy, FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatIban, ibanProblem } from "@/lib/domain/iban"
import {
  accountName,
  emptyPaymentAccount,
  MAX_PAYMENT_ACCOUNTS,
  SWIFT_RE,
  type PaymentAccount,
} from "@/lib/domain/payment-accounts"
import { cn } from "@/lib/utils"

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `acc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/**
 * Settings → Invoices → Payment accounts (docs/13 §11). Each invoice prints
 * the account its currency is assigned to, else the Default. A currency
 * already on another account can't be picked here (the server checks too).
 */
export function PaymentAccountsEditor({
  accounts,
  currencies,
  onChange,
}: {
  accounts: PaymentAccount[]
  /** The enabled currencies (Settings → Business). */
  currencies: string[]
  onChange: (accounts: PaymentAccount[]) => void
}) {
  const owner = new Map<string, number>()
  accounts.forEach((a, i) => a.currencies.forEach((c) => owner.has(c) || owner.set(c, i)))
  const defaultIndex = accounts.findIndex((a) => a.isDefault)

  const set = (i: number, patch: Partial<PaymentAccount>) =>
    onChange(accounts.map((a, j) => (j === i ? { ...a, ...patch } : a)))
  const makeDefault = (i: number) =>
    onChange(accounts.map((a, j) => ({ ...a, isDefault: j === i })))
  const remove = (i: number) => {
    const rest = accounts.filter((_, j) => j !== i)
    // Removing the Default hands it to the first account left.
    if (accounts[i]?.isDefault && rest[0]) rest[0] = { ...rest[0], isDefault: true }
    onChange(rest)
  }
  const add = () =>
    onChange([...accounts, emptyPaymentAccount(newId(), accounts.length === 0)])

  return (
    <fieldset className="grid gap-4 rounded-md border border-border p-4">
      <legend className="px-1 text-sm font-medium">Payment accounts</legend>
      <p className="-mt-1 text-sm text-ink-muted">
        Each invoice shows the bank details for its currency. Assign each currency to one
        account; the <b className="font-medium text-ink">Default</b> account is used for
        every other currency.
      </p>

      {accounts.length === 0 && (
        <p className="rounded-md bg-surface-subtle px-3 py-2 text-sm text-ink-muted">
          No accounts yet, so invoices show no bank details.
        </p>
      )}

      {accounts.map((a, i) => (
        <AccountCard
          key={a.id}
          account={a}
          index={i}
          accounts={accounts}
          currencies={currencies}
          owner={owner}
          onChange={(patch) => set(i, patch)}
          onMakeDefault={() => makeDefault(i)}
          onRemove={() => remove(i)}
        />
      ))}

      {accounts.length > 0 && (
        <p className="text-sm text-ink-muted" aria-live="polite">
          {summary(accounts, defaultIndex)}
        </p>
      )}

      <div>
        <Button
          type="button"
          variant="outline"
          onClick={add}
          disabled={accounts.length >= MAX_PAYMENT_ACCOUNTS}
          className="max-md:h-11"
        >
          <PlusIcon />
          Add account
        </Button>
      </div>
    </fieldset>
  )
}

/** "PKR invoices use Pakistan account. Any other currency uses Pakistan account." */
function summary(accounts: PaymentAccount[], defaultIndex: number) {
  const parts = accounts
    .map((a, i) =>
      a.currencies.length ? `${a.currencies.join(", ")} → ${accountName(a, i)}` : null
    )
    .filter(Boolean)
  const fallback =
    defaultIndex >= 0
      ? `Any other currency → ${accountName(accounts[defaultIndex]!, defaultIndex)}.`
      : "Mark one account as Default for the other currencies."
  return parts.length ? `${parts.join(" · ")}. ${fallback}` : fallback
}

function AccountCard({
  account: a,
  index,
  accounts,
  currencies,
  owner,
  onChange,
  onMakeDefault,
  onRemove,
}: {
  account: PaymentAccount
  index: number
  accounts: PaymentAccount[]
  currencies: string[]
  owner: Map<string, number>
  onChange: (patch: Partial<PaymentAccount>) => void
  onMakeDefault: () => void
  onRemove: () => void
}) {
  const id = (field: string) => `acct-${a.id}-${field}`
  const name = accountName(a, index)
  const iban = a.iban.trim() ? (ibanProblem(a.iban) ?? undefined) : undefined
  const swift =
    a.swift.trim() && !SWIFT_RE.test(a.swift.replace(/\s+/g, "").toUpperCase())
      ? "A SWIFT/BIC code has 8 or 11 letters and digits, like ABCDPKKA."
      : undefined
  // Enabled currencies, plus any this account still holds that were turned off.
  const options = [...new Set([...currencies, ...a.currencies])].sort()
  const takenHere = options.some((c) => (owner.get(c) ?? index) !== index)

  const field = (
    key:
      | "label"
      | "bankName"
      | "accountTitle"
      | "accountNumber"
      | "iban"
      | "swift"
      | "branchCode",
    label: string,
    opts: {
      help?: string
      error?: string
      mono?: boolean
      required?: boolean
      max: number
      className?: string
      onBlur?: () => void
    }
  ) => (
    <FormField
      id={id(key)}
      label={label}
      required={opts.required}
      help={opts.help}
      error={opts.error}
      className={opts.className}
    >
      <Input
        id={id(key)}
        value={a[key]}
        maxLength={opts.max}
        onChange={(e) => onChange({ [key]: e.target.value })}
        onBlur={opts.onBlur}
        aria-invalid={opts.error ? true : undefined}
        aria-describedby={fieldDescribedBy(id(key), opts)}
        className={cn(opts.mono && "font-mono")}
        autoComplete="off"
        spellCheck={false}
      />
    </FormField>
  )

  return (
    <section
      aria-label={name}
      className={cn(
        "grid gap-4 rounded-md border p-4",
        a.isDefault ? "border-brand-700/40 bg-surface-subtle" : "border-border"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-medium">{name}</h3>
        <div className="flex items-center gap-1">
          {a.isDefault ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-700/10 px-2 py-0.5 text-xs font-medium text-brand-700">
              <StarIcon aria-hidden className="size-3" />
              Default
            </span>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={onMakeDefault}>
              <StarIcon />
              Make default
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-ink-muted"
            onClick={onRemove}
            aria-label={`Remove ${name}`}
          >
            <Trash2Icon />
            Remove
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {field("label", "Label", {
          required: true,
          max: 60,
          help: "For you only, e.g. “Pakistan account”. Not printed.",
        })}
        {field("bankName", "Bank name", { required: true, max: 100 })}
        {field("accountTitle", "Account title", {
          required: true,
          max: 100,
          help: "The name on the account.",
        })}
        {field("accountNumber", "Account number", {
          max: 40,
          mono: true,
          help: "Account number, IBAN, or both.",
        })}
        {/* Full width: an IBAN is up to 34 characters, shown in groups of four. */}
        {field("iban", "IBAN", {
          max: 42,
          mono: true,
          error: iban,
          className: "sm:col-span-2",
          onBlur: () => {
            if (a.iban.trim() && !iban) onChange({ iban: formatIban(a.iban) })
          },
        })}
        {field("swift", "SWIFT/BIC", {
          max: 14,
          mono: true,
          error: swift,
          help: "Optional.",
        })}
        {field("branchCode", "Branch code", { max: 20, mono: true, help: "Optional." })}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Currencies</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((c) => {
            const other = owner.get(c)
            const takenBy =
              other !== undefined && other !== index ? accounts[other] : undefined
            const on = a.currencies.includes(c)
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                disabled={!!takenBy}
                title={
                  takenBy ? `${c} is on “${accountName(takenBy, other!)}”` : undefined
                }
                onClick={() =>
                  onChange({
                    currencies: on
                      ? a.currencies.filter((x) => x !== c)
                      : [...a.currencies, c].sort(),
                  })
                }
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm max-md:min-h-11",
                  on
                    ? "border-brand-700 bg-brand-700 text-white"
                    : "border-border bg-surface hover:bg-surface-hover",
                  takenBy &&
                    "cursor-not-allowed border-dashed bg-surface text-ink-subtle hover:bg-surface"
                )}
              >
                <span className="font-mono font-medium">{c}</span>
                {takenBy && (
                  <span className="text-xs">on {accountName(takenBy, other!)}</span>
                )}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-ink-muted">
          {a.isDefault
            ? "Optional for the Default account: it already covers every currency not assigned elsewhere."
            : "Invoices in these currencies show this account."}
          {takenHere &&
            " A currency can belong to only one account, so each invoice knows which bank details to print. Untick it on the other account first."}
        </p>
      </fieldset>
    </section>
  )
}
