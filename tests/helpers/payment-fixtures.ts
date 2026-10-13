// Made-up payment accounts for tests and the e2e seed. The IBANs pass the
// mod-97 check but use the bank code TEST / 000 and a 1234567890 account
// number, so they can't be anyone's real account.
import type { PaymentAccount } from "@/lib/domain/payment-accounts"

export const FAKE_IBAN = {
  PK: "PK11TEST0000001234567890",
  AE: "AE090000000001234567890",
  GB: "GB21TEST00000012345678",
} as const

/** Default account; PKR, and every currency without its own account. */
export const PK_ACCOUNT: PaymentAccount = {
  id: "pk-test",
  label: "Pakistan account",
  bankName: "Example Bank Pakistan",
  accountTitle: "Rehman Web Services",
  accountNumber: "0000001234567890",
  iban: FAKE_IBAN.PK,
  swift: "",
  branchCode: "0001",
  currencies: ["PKR"],
  isDefault: true,
}

/** AED only; no account number or branch code, so those rows must not print. */
export const AE_ACCOUNT: PaymentAccount = {
  id: "ae-test",
  label: "UAE account",
  bankName: "Example Bank UAE",
  accountTitle: "Rehman Web Services FZE",
  accountNumber: "",
  iban: FAKE_IBAN.AE,
  swift: "TESTAEADXXX",
  branchCode: "",
  currencies: ["AED"],
  isDefault: false,
}

export const TEST_ACCOUNTS: PaymentAccount[] = [PK_ACCOUNT, AE_ACCOUNT]
