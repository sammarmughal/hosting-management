// Setting keys and defaults (docs/03 §3). Shared by the seed script and
// lib/server/settings.ts, so it has no server-only import.
//
// Additions to the docs' table:
// - enabled_currencies: ISO 4217 codes offered on the client and service
//   forms, comma-separated (docs/13 §6).
// - smtp_encryption (SSL | TLS | None) replaces the boolean smtp_secure,
//   because the approved Email form offers three choices.
import { DEFAULT_STAGES } from "@/lib/domain/stages"

export const SETTING_DEFAULTS = {
  business_name: "Our Hosting",
  business_phone: "",
  // Optional line under the business name (wordmark) on invoices and emails.
  business_tagline: "",
  admin_email: "",
  admin_whatsapp: "",
  default_currency: "PKR",
  // docs/13 §6: PKR, USD and AED on for a new install.
  enabled_currencies: "AED,PKR,USD",
  threshold_orange_days: "30",
  threshold_red_days: "7",
  reminder_stages: DEFAULT_STAGES,
  post_expiry_to_client: "1",
  check_interval_minutes: "60",
  auto_send_emails: "0",
  auto_send_batch_size: "10",
  last_check_at: null,
  smtp_host: "smtp.hostinger.com",
  smtp_port: "465",
  smtp_encryption: "SSL",
  smtp_username: "",
  smtp_password_enc: "",
  mail_from_email: "",
  mail_from_name: "Our Hosting",
  // Settings → Invoices (docs/13 §11). business_address is printed on the
  // invoice header (docs/13 §7) but had no setting elsewhere.
  invoice_prefix: "INV",
  invoice_lead_days: "30",
  business_address: "",
  invoice_ntn: "",
  invoice_logo: "",
  // Bank details per currency, a JSON array (lib/domain/payment-accounts.ts).
  // Replaced pay_bank_name / pay_account_title / pay_account_number; the
  // migration moved those into one account marked Default.
  payment_accounts: "[]",
  pay_wallet: "",
  invoice_footer: "Please pay before the due date to avoid service interruption.",
  tax_enabled: "0",
  tax_rate: "0",
} satisfies Record<string, string | null>

export type SettingKey = keyof typeof SETTING_DEFAULTS
