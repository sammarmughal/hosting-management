// Payment accounts (Settings → Invoices, docs/13 §11): which bank details an
// invoice prints depends on its currency. Each currency belongs to at most
// one account; the account marked Default covers every other currency. Pure,
// so the form, the Server Action, the snapshot and the tests share it.
import { z } from "zod"

import { isCurrencyCode } from "@/lib/domain/currency"
import { formatIban, ibanProblem, normaliseIban } from "@/lib/domain/iban"

export const MAX_PAYMENT_ACCOUNTS = 10

export interface PaymentAccount {
  /** Stable id for the form's list keys; never printed. */
  id: string
  /** For you only, e.g. "Pakistan account"; not printed on invoices. */
  label: string
  bankName: string
  accountTitle: string
  accountNumber: string
  /** Stored without spaces, upper case; printed in groups of four. */
  iban: string
  /** SWIFT/BIC, optional. */
  swift: string
  /** Optional. */
  branchCode: string
  /** ISO 4217 codes this account is used for, alphabetical. */
  currencies: string[]
  isDefault: boolean
}

/** What an invoice keeps of the chosen account (docs/13 §2 seller snapshot). */
export type PaymentAccountSnapshot = Omit<
  PaymentAccount,
  "id" | "currencies" | "isDefault"
>

export const SWIFT_RE = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/

export const emptyPaymentAccount = (id: string, isDefault: boolean): PaymentAccount => ({
  id,
  label: "",
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  iban: "",
  swift: "",
  branchCode: "",
  currencies: [],
  isDefault,
})

export type AccountField = Exclude<keyof PaymentAccount, "id">

export interface AccountIssue {
  /** Index in the list; null for a problem with the list as a whole. */
  index: number | null
  field: AccountField | null
  message: string
}

const MAX: Partial<Record<AccountField, number>> = {
  label: 60,
  bankName: 100,
  accountTitle: 100,
  accountNumber: 40,
  branchCode: 20,
}

/** "Account 2" when the label is still empty. */
export const accountName = (a: Pick<PaymentAccount, "label">, index: number) =>
  a.label.trim() || `Account ${index + 1}`

/**
 * Every problem with the list, in form order. Messages name the account, so
 * they read well on their own (the Server Action returns only the first).
 */
export function paymentAccountIssues(
  accounts: readonly PaymentAccount[]
): AccountIssue[] {
  const issues: AccountIssue[] = []
  if (accounts.length > MAX_PAYMENT_ACCOUNTS)
    issues.push({
      index: null,
      field: null,
      message: `Add at most ${MAX_PAYMENT_ACCOUNTS} accounts.`,
    })

  const owner = new Map<string, number>()
  const labels = new Map<string, number>()
  accounts.forEach((a, i) => {
    const name = accountName(a, i)
    const add = (field: AccountField, message: string) =>
      issues.push({ index: i, field, message: `${name}: ${message}` })

    if (!a.label.trim())
      add("label", "Give the account a label, like “Pakistan account”.")
    if (!a.bankName.trim()) add("bankName", "Enter the bank name.")
    if (!a.accountTitle.trim())
      add("accountTitle", "Enter the account title (the name on the account).")
    if (!a.accountNumber.trim() && !a.iban.trim())
      add("accountNumber", "Enter the account number, the IBAN, or both.")
    for (const [field, max] of Object.entries(MAX) as [AccountField, number][])
      if (String(a[field]).trim().length > max)
        add(field, `Keep it under ${max} characters.`)

    if (a.iban.trim()) {
      const problem = ibanProblem(a.iban)
      if (problem) add("iban", problem)
    }
    if (a.swift.trim() && !SWIFT_RE.test(a.swift.replace(/\s+/g, "").toUpperCase()))
      add("swift", "A SWIFT/BIC code has 8 or 11 letters and digits, like ABCDPKKA.")

    const label = a.label.trim().toLowerCase()
    if (label) {
      if (labels.has(label))
        add("label", "Another account has the same label. Give each a different one.")
      else labels.set(label, i)
    }

    for (const c of a.currencies) {
      if (!isCurrencyCode(c)) {
        add("currencies", `${c} isn’t a currency code.`)
        continue
      }
      const first = owner.get(c)
      if (first !== undefined && first !== i)
        add(
          "currencies",
          `${c} is already on “${accountName(accounts[first]!, first)}”. A currency can belong to only one account, so each invoice knows which bank details to print.`
        )
      else owner.set(c, i)
    }
  })

  const defaults = accounts.filter((a) => a.isDefault).length
  if (accounts.length > 0 && defaults === 0)
    issues.push({
      index: null,
      field: "isDefault",
      message:
        "Mark one account as Default. It’s used for every currency not assigned to an account.",
    })
  if (defaults > 1)
    issues.push({
      index: null,
      field: "isDefault",
      message: "Only one account can be the Default.",
    })
  return issues
}

/** Trimmed, IBAN and SWIFT without spaces, currencies upper case and sorted. */
export function normaliseAccount(a: PaymentAccount): PaymentAccount {
  return {
    id: a.id,
    label: a.label.trim(),
    bankName: a.bankName.trim(),
    accountTitle: a.accountTitle.trim(),
    accountNumber: a.accountNumber.trim(),
    iban: normaliseIban(a.iban),
    swift: a.swift.replace(/\s+/g, "").toUpperCase(),
    branchCode: a.branchCode.trim(),
    currencies: [...new Set(a.currencies.map((c) => c.trim().toUpperCase()))].sort(),
    isDefault: a.isDefault,
  }
}

const str = z.string().max(200)
const accountShape = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "Invalid account id"),
  label: str,
  bankName: str,
  accountTitle: str,
  accountNumber: str,
  iban: str,
  swift: str,
  branchCode: str,
  currencies: z.array(z.string().max(3)).max(200),
  isDefault: z.boolean(),
})

/** The list as saved by Settings → Invoices; issues come from paymentAccountIssues. */
export const paymentAccountsSchema = z
  .array(accountShape)
  .transform((list) => list.map(normaliseAccount))
  .superRefine((list, ctx) => {
    for (const issue of paymentAccountIssues(list))
      ctx.addIssue({
        code: "custom",
        path: issue.index === null ? [] : [issue.index, issue.field ?? ""],
        message: issue.message,
      })
  })

/** Reads the stored JSON; anything malformed is dropped rather than thrown. */
export function parsePaymentAccounts(json: string | null | undefined): PaymentAccount[] {
  let raw: unknown
  try {
    raw = JSON.parse(json || "[]")
  } catch {
    return []
  }
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    const r = accountShape.safeParse(item)
    return r.success ? [normaliseAccount(r.data)] : []
  })
}

/**
 * The account for an invoice in `currency`: the one the currency is assigned
 * to, else the Default, else none (no accounts set up).
 */
export function accountForCurrency(
  accounts: readonly PaymentAccount[],
  currency: string
): PaymentAccount | null {
  const code = currency.trim().toUpperCase()
  return (
    accounts.find((a) => a.currencies.includes(code)) ??
    accounts.find((a) => a.isDefault) ??
    null
  )
}

export function toAccountSnapshot(a: PaymentAccount): PaymentAccountSnapshot {
  return {
    label: a.label,
    bankName: a.bankName,
    accountTitle: a.accountTitle,
    accountNumber: a.accountNumber,
    iban: a.iban,
    swift: a.swift,
    branchCode: a.branchCode,
  }
}

/** The payment part of an invoice's seller snapshot. */
export interface PaymentSnapshot {
  account: PaymentAccountSnapshot | null
  /** JazzCash / Easypaisa number; "" when not set or not a PKR invoice. */
  wallet: string
}

/** JazzCash and Easypaisa take rupees only, so other invoices don't print the number. */
export const WALLET_CURRENCY = "PKR"

/** The payment part of a new snapshot: the currency's account, and the wallet on PKR invoices. */
export function paymentSnapshot(
  accounts: readonly PaymentAccount[],
  wallet: string,
  currency: string
): PaymentSnapshot {
  const account = accountForCurrency(accounts, currency)
  return {
    account: account ? toAccountSnapshot(account) : null,
    wallet: currency.trim().toUpperCase() === WALLET_CURRENCY ? wallet.trim() : "",
  }
}

/** Invoices created before payment accounts kept one flat set of bank details. */
interface LegacyPayment {
  bankName?: string
  accountTitle?: string
  accountNumber?: string
  wallet?: string
}

export interface PaymentRow {
  label: string
  value: string
}

/**
 * The lines an invoice prints (PDF, public page, email), only the filled ones
 * and in a fixed order. The account's label is for you, so it isn't printed.
 */
export function paymentRows(
  payment: PaymentSnapshot | LegacyPayment | null | undefined
): PaymentRow[] {
  if (!payment) return []
  const rows: [string, string | undefined][] =
    "account" in payment
      ? [
          ["Bank", payment.account?.bankName],
          ["Account title", payment.account?.accountTitle],
          ["Account number", payment.account?.accountNumber],
          ["IBAN", payment.account?.iban ? formatIban(payment.account.iban) : ""],
          ["SWIFT/BIC", payment.account?.swift],
          ["Branch code", payment.account?.branchCode],
          ["JazzCash / Easypaisa", payment.wallet],
        ]
      : [
          ["Bank", payment.bankName],
          ["Account title", payment.accountTitle],
          ["Account / IBAN", payment.accountNumber],
          ["JazzCash / Easypaisa", payment.wallet],
        ]
  return rows.flatMap(([label, value]) => {
    const v = (value ?? "").trim()
    return v ? [{ label, value: v }] : []
  })
}

/** Plain text for messages: "Bank: Example Bank\nIBAN: PK11 …". */
export const paymentText = (rows: readonly PaymentRow[]) =>
  rows.map((r) => `${r.label}: ${r.value}`).join("\n")
