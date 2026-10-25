// Payment accounts and IBANs (Settings → Invoices, docs/13 §11).
import { describe, expect, it } from "vitest"

import { formatIban, ibanProblem, normaliseIban } from "@/lib/domain/iban"
import { invoiceEmail, paymentDetailsText } from "@/lib/domain/messages"
import {
  accountForCurrency,
  paymentAccountIssues,
  paymentAccountsSchema,
  paymentRows,
  parsePaymentAccounts,
  paymentSnapshot,
  toAccountSnapshot,
  type PaymentAccount,
} from "@/lib/domain/payment-accounts"
import { invoiceSettingsSchema, INITIAL_PREFERENCES } from "@/lib/domain/preferences"

import {
  AE_ACCOUNT,
  FAKE_IBAN,
  PK_ACCOUNT,
  TEST_ACCOUNTS,
} from "../helpers/payment-fixtures"

const messages = (accounts: PaymentAccount[]) =>
  paymentAccountIssues(accounts).map((i) => i.message)

describe("IBAN validation", () => {
  it("accepts valid IBANs with or without spaces and in any case", () => {
    for (const iban of Object.values(FAKE_IBAN)) expect(ibanProblem(iban)).toBeNull()
    expect(ibanProblem("pk11 test 0000 0012 3456 7890")).toBeNull()
    expect(ibanProblem("AE09-0000-0000-0123-4567-890")).toBeNull()
  })

  it("checks the length for the country", () => {
    expect(ibanProblem("PK11TEST000000123456789")).toBe(
      "A PK IBAN has 24 characters; this one has 23."
    )
    expect(ibanProblem("AE0900000000012345678901")).toBe(
      "A AE IBAN has 23 characters; this one has 24."
    )
  })

  it("checks the mod-97 check digits", () => {
    // One digit changed, and two digits swapped: both caught.
    expect(ibanProblem("PK11TEST0000001234567891")).toMatch(/check digits don’t match/)
    expect(ibanProblem("PK11TEST0000002134567890")).toMatch(/check digits don’t match/)
    expect(ibanProblem("PK12TEST0000001234567890")).toMatch(/check digits don’t match/)
  })

  it("explains a wrong country code or stray characters", () => {
    expect(ibanProblem("1234")).toMatch(/2-letter country code/)
    expect(ibanProblem("ZZ11TEST0000001234567890")).toMatch(
      /ZZ isn’t a country that uses IBANs/
    )
    expect(ibanProblem("PK1!TEST0000001234567890")).toMatch(/only letters and digits/)
  })

  it("normalises and prints in groups of four", () => {
    expect(normaliseIban(" pk11 test-0000 ")).toBe("PK11TEST0000")
    expect(formatIban(FAKE_IBAN.PK)).toBe("PK11 TEST 0000 0012 3456 7890")
    expect(formatIban(FAKE_IBAN.AE)).toBe("AE09 0000 0000 0123 4567 890")
  })
})

describe("currency → account", () => {
  it("picks the account the currency is assigned to", () => {
    expect(accountForCurrency(TEST_ACCOUNTS, "PKR")?.id).toBe("pk-test")
    expect(accountForCurrency(TEST_ACCOUNTS, "AED")?.id).toBe("ae-test")
    expect(accountForCurrency(TEST_ACCOUNTS, " aed ")?.id).toBe("ae-test")
  })

  it("falls back to the Default for any other currency", () => {
    expect(accountForCurrency(TEST_ACCOUNTS, "USD")?.id).toBe("pk-test")
    // The Default doesn't have to be first, or have currencies of its own.
    const accounts = [
      { ...AE_ACCOUNT, isDefault: false },
      { ...PK_ACCOUNT, currencies: [], isDefault: true },
    ]
    expect(accountForCurrency(accounts, "PKR")?.id).toBe("pk-test")
    expect(accountForCurrency(accounts, "AED")?.id).toBe("ae-test")
  })

  it("an assigned currency wins over the Default", () => {
    // USD assigned to the UAE account: the Default (Pakistan) no longer gets it.
    const usdOnUae = [PK_ACCOUNT, { ...AE_ACCOUNT, currencies: ["AED", "USD"] }]
    expect(accountForCurrency(usdOnUae, "USD")?.id).toBe("ae-test")
  })

  it("no accounts → no bank details", () => {
    expect(accountForCurrency([], "PKR")).toBeNull()
  })
})

describe("account list validation", () => {
  it("accepts the test accounts", () => {
    expect(paymentAccountIssues(TEST_ACCOUNTS)).toEqual([])
    expect(paymentAccountIssues([])).toEqual([])
  })

  it("rejects a currency on two accounts, naming both and saying why", () => {
    const dup = [PK_ACCOUNT, { ...AE_ACCOUNT, currencies: ["AED", "PKR"] }]
    expect(messages(dup)).toEqual([
      "UAE account: PKR is already on “Pakistan account”. A currency can belong to only one account, so each invoice knows which bank details to print.",
    ])
    const issue = paymentAccountIssues(dup)[0]
    expect(issue).toMatchObject({ index: 1, field: "currencies" })
  })

  it("needs exactly one Default", () => {
    expect(messages([{ ...PK_ACCOUNT, isDefault: false }, AE_ACCOUNT])).toEqual([
      "Mark one account as Default. It’s used for every currency not assigned to an account.",
    ])
    expect(messages([PK_ACCOUNT, { ...AE_ACCOUNT, isDefault: true }])).toEqual([
      "Only one account can be the Default.",
    ])
  })

  it("explains a bad IBAN and SWIFT on the right account", () => {
    const bad = [
      PK_ACCOUNT,
      { ...AE_ACCOUNT, iban: "AE090000000001234567891", swift: "TEST" },
    ]
    expect(messages(bad)).toEqual([
      "UAE account: This IBAN’s check digits don’t match. Look for a typo.",
      "UAE account: A SWIFT/BIC code has 8 or 11 letters and digits, like ABCDPKKA.",
    ])
  })

  it("needs a label, bank, title, and an account number or IBAN", () => {
    const blank = { ...AE_ACCOUNT, label: "", bankName: " ", accountTitle: "", iban: "" }
    expect(messages([PK_ACCOUNT, blank])).toEqual([
      "Account 2: Give the account a label, like “Pakistan account”.",
      "Account 2: Enter the bank name.",
      "Account 2: Enter the account title (the name on the account).",
      "Account 2: Enter the account number, the IBAN, or both.",
    ])
    // An account number alone is enough (countries without IBANs).
    expect(messages([{ ...PK_ACCOUNT, iban: "" }])).toEqual([])
  })

  it("rejects two accounts with the same label", () => {
    expect(messages([PK_ACCOUNT, { ...AE_ACCOUNT, label: "pakistan ACCOUNT" }])).toEqual([
      "pakistan ACCOUNT: Another account has the same label. Give each a different one.",
    ])
  })

  it("the settings schema normalises and returns the first problem", () => {
    const parsed = paymentAccountsSchema.parse([
      { ...PK_ACCOUNT, iban: "pk11 test 0000 0012 3456 7890", currencies: ["pkr"] },
      { ...AE_ACCOUNT, swift: "testaead xxx" },
    ])
    expect(parsed[0]).toMatchObject({ iban: FAKE_IBAN.PK, currencies: ["PKR"] })
    expect(parsed[1]?.swift).toBe("TESTAEADXXX")

    const r = invoiceSettingsSchema.safeParse({
      ...INITIAL_PREFERENCES.invoices,
      accounts: [PK_ACCOUNT, { ...AE_ACCOUNT, currencies: ["PKR"] }],
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toMatch(/PKR is already on “Pakistan account”/)
  })
})

describe("what an invoice prints", () => {
  it("only the chosen account's filled fields, IBAN in groups of four", () => {
    const pk = paymentRows({ account: toAccountSnapshot(PK_ACCOUNT), wallet: "" })
    expect(pk).toEqual([
      { label: "Bank", value: "Example Bank Pakistan" },
      { label: "Account title", value: "Rehman Web Services" },
      { label: "Account number", value: "0000001234567890" },
      { label: "IBAN", value: "PK11 TEST 0000 0012 3456 7890" },
      { label: "Branch code", value: "0001" },
    ])
    const ae = paymentRows({
      account: toAccountSnapshot(AE_ACCOUNT),
      wallet: "0300 0000000",
    })
    expect(ae.map((r) => r.label)).toEqual([
      "Bank",
      "Account title",
      "IBAN",
      "SWIFT/BIC",
      "JazzCash / Easypaisa",
    ])
  })

  it("snapshots the currency's account, and the wallet on PKR invoices only", () => {
    expect(paymentSnapshot(TEST_ACCOUNTS, "0300 0000000", "PKR")).toEqual({
      account: toAccountSnapshot(PK_ACCOUNT),
      wallet: "0300 0000000",
    })
    // JazzCash / Easypaisa take rupees only.
    expect(paymentSnapshot(TEST_ACCOUNTS, "0300 0000000", "AED")).toEqual({
      account: toAccountSnapshot(AE_ACCOUNT),
      wallet: "",
    })
    // USD: the Default account, no wallet.
    expect(paymentSnapshot(TEST_ACCOUNTS, "0300 0000000", "USD")).toEqual({
      account: toAccountSnapshot(PK_ACCOUNT),
      wallet: "",
    })
    expect(paymentSnapshot([], "", "PKR")).toEqual({ account: null, wallet: "" })
  })

  it("prints nothing without an account or wallet, and reads the old flat snapshot", () => {
    expect(paymentRows({ account: null, wallet: "" })).toEqual([])
    expect(paymentRows(undefined)).toEqual([])
    expect(
      paymentRows({
        bankName: "Example Bank",
        accountTitle: "",
        accountNumber: "123",
        wallet: "",
      })
    ).toEqual([
      { label: "Bank", value: "Example Bank" },
      { label: "Account / IBAN", value: "123" },
    ])
  })

  it("parses stored JSON, dropping anything malformed", () => {
    expect(parsePaymentAccounts(JSON.stringify(TEST_ACCOUNTS))).toEqual(TEST_ACCOUNTS)
    expect(parsePaymentAccounts("not json")).toEqual([])
    expect(parsePaymentAccounts('{"a":1}')).toEqual([])
    expect(parsePaymentAccounts(JSON.stringify([{ id: "x" }, PK_ACCOUNT]))).toEqual([
      PK_ACCOUNT,
    ])
  })
})

describe("invoice email payment details", () => {
  const service = {
    domain: "example.pk",
    serviceName: "Web Hosting",
    clientName: "Test Client",
    renewalDate: "2026-11-01",
    daysLeft: 10,
    chargeAmount: "6500",
    currency: "AED",
    colour: "green" as const,
  }
  const business = { businessName: "Rehman Web Services", businessPhone: "0300 0000000" }
  const invoice = {
    number: "INV-2026-0001",
    link: "https://renewals.example/i/abc",
    total: "500",
    currency: "AED",
    dueDate: "2026-11-01",
    payment: paymentRows({ account: toAccountSnapshot(AE_ACCOUNT), wallet: "" }),
  }

  it("fills {{payment_details}} with the invoice's account, escaped", () => {
    const t = { subject: "Invoice", body: "<p>Hi</p>\n{{payment_details}}\n<p>Bye</p>" }
    const r = invoiceEmail(t, service, business, "2026-10-22", {
      ...invoice,
      payment: [{ label: "Bank", value: "A & B <Bank>" }],
    })
    expect(r.body).toContain(
      "<p><b>Payment details</b><br>Bank: A &amp; B &lt;Bank&gt;</p>"
    )
    expect(r.body.indexOf("Payment details")).toBeLessThan(r.body.indexOf("Bye"))
  })

  it("adds the details at the end when an edited template leaves the placeholder out", () => {
    const r = invoiceEmail(
      { subject: "Invoice", body: "<p>Hi</p>" },
      service,
      business,
      "2026-10-22",
      invoice
    )
    expect(r.text).toContain("IBAN: AE09 0000 0000 0123 4567 890")
    expect(r.text).toContain("SWIFT/BIC: TESTAEADXXX")
    expect(r.text).not.toContain("Account number")
  })

  it("leaves no empty block without an account", () => {
    const t = { subject: "Invoice", body: "<p>Hi</p>{{payment_details}}" }
    const r = invoiceEmail(t, service, business, "2026-10-22", {
      ...invoice,
      payment: [],
    })
    expect(r.body).toBe("<p>Hi</p>")
    expect(paymentDetailsText([])).toBe("")
  })
})
