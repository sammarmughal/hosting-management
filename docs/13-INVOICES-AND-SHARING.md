# 13 — Invoices, sharing, currency and going functional

This file covers the client's feedback after the UI demo. The UI is approved as is. The work now is to make it fully functional and to add invoices.

Priority of docs: on invoices, sharing and currency, **this file wins**. On visuals, `12-DESIGN-DIRECTION.md` still wins. Everything else stays as defined in `01`–`11`.

## 0. What the client asked for

1. Make the existing UI properly functional (real data, real emails, real reminders). No redesign.
2. Currency handling: each client has their own currency, no conversion (see §6; confirmed with the client on 11 Oct 2026).
3. Send a reminder to the customer on **both email and WhatsApp with a single click**.
4. Create a proper **invoice** for every renewal. It is sent along with the reminder on email and WhatsApp, and can be **downloaded as a PDF**.
5. The invoice must be available in the system **30 or 15 days before the renewal date** (configurable).
6. A **Share invoice** button that asks "WhatsApp or Email". The client's WhatsApp number or email is picked up automatically from the client record.

## 1. Important constraint: WhatsApp

A `wa.me` link can only open WhatsApp with **pre-filled text**. It cannot attach a PDF and cannot send by itself; the owner still presses Send inside WhatsApp. So:

- **Now (free, no approval needed):** the WhatsApp message contains a **secure invoice link** (`https://<app>/i/<token>`). The customer taps it, sees the invoice and downloads the PDF. Email gets the PDF as a real attachment plus the same link.
- **Decision (11 Oct 2026): link-based only, no paid API for now.** The rest of this bullet stays as background in case that changes.
- **Later (optional, not planned):** WhatsApp Business Cloud API (Meta) can send the PDF itself fully automatically. It needs Meta business verification, an approved message template with a document header, and has per-conversation cost. Build sending behind a `WhatsAppProvider` interface with a `link` implementation now, so a `cloud` implementation can be added later without touching the UI.

"Single click for both" therefore means: one click sends the email in the background **and** opens WhatsApp with the message ready.

## 2. Invoice data model

`Invoice`
- `id`, `number` (unique, e.g. `INV-2026-0012`)
- `clientId`, `serviceId`
- `periodStart` (the current renewal date), `periodEnd` (periodStart + billing cycle, default 1 year)
- `issueDate`, `dueDate` (= renewal date)
- `currency` (copied from the service)
- `subtotal`, `discount` (default 0), `taxRate` (default 0), `taxAmount`, `total` (store money the same way `lib/domain/money.ts` does; never floats)
- `status`: `issued` | `sent` | `paid` | `void`. **Overdue is derived** (dueDate passed and not paid), never stored.
- `billTo` (JSON snapshot of client name, company, email, phone, address at issue time)
- `seller` (JSON snapshot of business details at issue time, including the **payment account chosen by the invoice's currency**, §6a), so editing settings later never changes old invoices. "Refresh business details" re-copies it, account included, on unpaid invoices; paid and void invoices stay locked.
- `notes`
- `publicToken` (32 random bytes as 64 lowercase hex characters, so the case-insensitive collation can't make two tokens equal; the lookup also compares exactly), `publicTokenRevokedAt`
- `firstSentAt`, `paidAt`, `paymentId`, `voidedAt`, `createdAt`, `updatedAt`
- Unique constraint on `(serviceId, periodStart)` so each renewal cycle has exactly one invoice.

`InvoiceItem`: `invoiceId`, `description` (e.g. "Hosting renewal — noordental.pk"), `periodLabel` ("30 Sep 2026 → 30 Sep 2027"), `quantity`, `unitAmount`, `amount`.

`InvoiceEvent` (or reuse the activity log): `created`, `email_sent`, `email_failed` (with error), `whatsapp_opened`, `whatsapp_marked_sent`, `link_viewed`, `pdf_downloaded`, `paid`, `voided`, `link_regenerated`.

## 3. Numbering

- Format `{prefix}-{YYYY}-{seq}`, seq zero-padded to 4 digits. Prefix from settings, default `INV`.
- Sequence is per year, allocated inside a DB transaction (`invoice_counters` row: `INSERT … ON DUPLICATE KEY UPDATE next = next + 1`, then `SELECT next - 1`; the row lock serialises parallel requests and a rollback gives the number back, docs/03 §2). Numbers are never reused; a voided invoice keeps its number.

## 4. When invoices are created

- Setting `invoiceLeadDays`, choices **15** or **30** (default 30), plus a custom value.
- The daily check (the existing "Check now" + the scheduled job) creates an invoice for every **active** service where `daysLeft <= invoiceLeadDays` and no invoice exists for that cycle. Idempotent: running it twice creates nothing new.
- Cancelled services never get invoices.
- Manual "Create invoice now" on the service card works at any time (also outside the window).
- Each creation produces a notification "Invoice INV-2026-0012 created for noordental.pk".
- While an invoice is `issued` or `sent` and unpaid, "Update from service" regenerates amounts/items from the current service (same number). Paid and void invoices are locked.

## 5. Lifecycle

- **Mark as paid** opens the existing Renew dialog pre-filled with the invoice total and currency. Confirming records the payment, advances the renewal date, sets the invoice `paid` and links `paymentId`.
- Recording a renewal through the normal Renew dialog for a service that has an unpaid invoice for that cycle also marks that invoice paid.
- **Void** asks for confirmation and an optional reason.
- Paid invoices show a "Paid on 30 Sep 2026" mark on screen and on the PDF.

## 6. Currency

Confirmed with the client on 11 Oct 2026: **no conversion. Each client has their own currency** (a Pakistani client pays in PKR, a UAE client in AED).

**Where the currency lives**
- **Client:** `clients.currency` (ISO 4217, required). It starts as the app default when the client is added, and is shown on the client form and the client page.
- **Service:** `services.currency`. A new service starts in its client's currency, and can be changed on the service form (e.g. one USD service for a PKR client).
- **Invoice and payment:** they take the service's currency, so for most clients that's the client's currency. Changing a client's currency later does not change existing services, invoices or payments.

**Settings → Business**
- **Currencies:** any ISO 4217 currency can be turned on from a searchable picker (code and name, e.g. "AED · United Arab Emirates Dirham"). PKR, USD and AED are on for a new install. The client and service forms offer only the enabled currencies (plus a record's current one, so an edit never loses it).
- A currency used by **any client or service can't be turned off**. Its row is locked and says why ("Used by 2 clients and 3 services"), with the same reason in a tooltip; the server refuses it too. The default currency can't be removed either.
- **Default currency:** what new clients start in (and the fallback for import).

**Amounts and formatting** (`lib/domain/currency.ts`, `lib/domain/money.ts`)
- Currency names and decimal places come from `Intl`: `PKR 6,500`, `JPY 150,000` (0 decimals), `USD 49.99`, `KWD 12.500` (3 decimals). No decimals are shown when the fraction is zero. An amount may not have more decimals than its currency allows ("PKR amounts can’t have decimals"); a value saved earlier with more is shown in full, never rounded away.
- Money is stored as `DECIMAL(15,3)` and handled as integer thousandths, never floats. Invoice tax is rounded to the currency's minor unit.
- Totals are **grouped per currency everywhere** (dashboard stat "Expected in 30 days", payments summary strip, invoice list, admin summary). Different currencies are never added together, and there is no exchange-rate conversion.

**Import and export (CSV)**
- `client_currency` (after `address`): the client's currency. Blank = the app default.
- `currency`: the service's currency. Blank = the client's currency.
- Both must be turned on in Settings, otherwise the row is an error. A row for an existing client (same name + email or phone) keeps that client's currency. The services export writes both columns, and amounts with the currency's decimals.

**Existing data:** migration `client_currency_and_money_scale` gave every client the currency most of their services use (ties go to the app default, then alphabetical), or the app default when they have no services.

## 6a. Payment accounts

Owner request (13 Oct 2026): **payment details depend on the invoice currency.** A PKR invoice shows the Pakistani bank account, an AED invoice the UAE one. Settings → Invoices → **Payment accounts** replaces the single set of bank details.

**Each account has**
- **Label**, e.g. "Pakistan account". It is for the owner only and isn't printed.
- **Bank name** and **account title**.
- **Account number** and **IBAN**: at least one of the two (some countries have no IBAN).
- **SWIFT/BIC** and **branch code**, both optional.
- **Currencies** it is used for.

**Rules** (`lib/domain/payment-accounts.ts`, checked in the form and again by the server)
- One account is marked **Default**. It is used for any currency not assigned to another account, so a USD invoice with no USD account shows the Default.
- A currency can belong to **only one account**. In the form, a currency that's already on another account is greyed out with "on Pakistan account". The help line explains why: each invoice must know which bank details to print. The server refuses a duplicate with the same reason.
- **IBANs are validated** (`lib/domain/iban.ts`): country code, the registry length for that country, and the mod-97 check digits. The error says what's wrong, e.g. "A PK IBAN has 24 characters; this one has 23." or "This IBAN's check digits don't match. Look for a typo." IBANs are stored without spaces and printed in groups of four.
- **SWIFT/BIC** must be 8 or 11 letters and digits.
- Labels must be different. There are at most 10 accounts.
- Stored as JSON in the `payment_accounts` setting.

**On invoices**
- The account is chosen when the invoice is created: the one the invoice's currency is assigned to, else the Default, else none. It is stored in the seller snapshot.
- "Refresh business details" (unpaid invoices only) chooses it again from the current settings. "Update from service" chooses it again only if the currency changed.
- The PDF, the public page and the invoice email print **only the chosen account's filled fields**, with no empty rows and no label. They print nothing when there's no account.
- The invoice email has a `{{payment_details}}` placeholder. When an edited template leaves it out, the details are added at the end.
- The **JazzCash / Easypaisa** number stays a single setting outside the accounts. It is printed on **PKR invoices only**, because those wallets take rupees.

**Existing data:** migration `payment_accounts` moved the old bank name, account title and account number into one account called "Main account", marked Default and with no currencies. An account number that looked like an IBAN went into the IBAN field.

## 7. Invoice PDF

- Generated server-side with `@react-pdf/renderer` (pure Node, no headless browser, works with the standalone build). Generated on demand; no PDF files stored on disk.
- Routes: `GET /api/invoices/[id]/pdf` (authenticated) and `GET /i/[token]/pdf` (public). `Content-Disposition` filename: `Invoice-INV-2026-0012-noordental.pk.pdf`.
- A4, one page for normal invoices. Fonts: Geist (register TTF files; if the `geist` package only ships woff2, add the TTF files under `src/assets/fonts`).
- Layout, top to bottom:
  1. Logo + business name, address, phone, email, NTN (optional) on the left; "Invoice" title, number, issue date, due date and status on the right.
     **No logo** (the owner's choice, 12 Oct 2026: the business name is the logo): the business name is a text wordmark in the logo position (Geist, about 19 px, weight 600, ink), with the optional **tagline** (Settings → Business) under it in muted text. No image box, placeholder or gap. The same wordmark heads the public page and every email; the app's sidebar shows the business initials (e.g. "AR") in a small square instead of a logo.
  2. "Bill to": client name, company, email, phone.
  3. Items table: Description, Period, Qty, Amount (right-aligned, tabular).
  4. Totals: Subtotal, Discount (if any), Tax (if any), **Total** with currency.
  5. Payment instructions: the filled fields of the account in the snapshot (§6a), in this order: Bank, Account title, Account number, IBAN, SWIFT/BIC, Branch code, then JazzCash / Easypaisa on PKR invoices. The values are in the monospace font, so they copy out of the PDF exactly (the regular font's ligatures don't).
  6. Footer note from settings (e.g. "Please pay before the due date to avoid service interruption.").
- Same visual rules as `12` (neutral, hairlines, brand colour only for the title/accents, no gradients, no emoji).

## 8. Public invoice page `/i/[token]`

- No login. `noindex`. Shows the invoice as HTML in the same design, with a "Download PDF" button and the payment instructions (the invoice's account, §6a).
- Invalid or revoked token → a neutral "This invoice link is no longer valid" page (no detail leaks).
- Owner can "Regenerate link" (revokes the old token). Logs `link_viewed` / `pdf_downloaded` events.
- Basic rate limiting on `/i/*`.

## 9. Share invoice

`ShareInvoiceDialog`, opened from: invoice list ⋯, invoice detail, the service card on the client page, and reminder queue rows.

- Three options as selectable cards: **WhatsApp**, **Email**, **Both**.
- Recipients are filled automatically from the client: "+92 300 1234567", "ali@noordental.pk". If one is missing or invalid, that option is disabled with the reason and an "Edit client" link.
- A collapsible "Message" section shows the rendered template (editable for this send only).
- **Email:** sent server-side via SMTP with the PDF attached and the invoice link in the body. Shows pending → sent / failed with the real error and a Retry.
- **WhatsApp:** opens `https://wa.me/<number>?text=<message with invoice link>` in a new tab. The URL must be built **before** the click and opened synchronously inside the click handler (no `await` before `window.open`), otherwise the browser blocks the pop-up. Afterwards the row shows "Opened · Mark as sent".
- **Both:** opens WhatsApp immediately and sends the email in the background. Toast: "Email sent to Ali Khan · WhatsApp opened".
- Every share is logged in the invoice events and the reminder log, and sets `status = sent` the first time.

## 10. Reminders + invoices together

- When a reminder fires for a service that has an invoice for this cycle, the reminder email attaches the PDF and both channels include the invoice link.
- New template placeholders: `{{invoice_number}}`, `{{invoice_link}}`, `{{invoice_total}}`, `{{due_date}}`, and in the Invoice templates `{{payment_details}}` (the invoice's account, §6a). A new template "Invoice" (email subject + body, WhatsApp body) in Settings → Templates.
- Reminder queue rows: a new primary per-row action **"Send email + WhatsApp"** (single click, as in §9 "Both"), and an invoice chip ("INV-2026-0012 · Unpaid") that opens the invoice.
- Bulk "Send N emails" stays as is for email. For WhatsApp in bulk, a **WhatsApp queue** dialog steps through the list: "1 of 5 · Ali Khan · Open WhatsApp" → Next. (Browsers block opening many tabs at once, and each message still needs Send pressed in WhatsApp.)

## 11. Screens to add or change

- **Nav:** add "Invoices" between Reminders and Payments (icon `FileText`).
- **/invoices:** header "Invoices" + count; filters: status (All · Unpaid · Overdue · Paid · Void), search, date range, currency, all in URL params. Table: Number (mono), Client (2 lines), Domain, Issue date, Due date, Amount (right), Status badge, ⋯ (View, Download PDF, Share, Copy link, Mark as paid, Void). Totals strip per currency. Mobile cards. Empty + loading states.
- **/invoices/[id]:** the invoice preview (same as the public page) on the left; on the right an actions panel (Share as the one primary button, Download PDF, Copy link, Mark as paid, Update from service, Regenerate link, Void) and the event timeline.
- **Client detail:** an "Invoices" tab; each service card shows the current-cycle invoice chip and a Share invoice button.
- **Dashboard:** queue rows get the invoice chip and "Send email + WhatsApp".
- **Settings → Invoices** (new section): prefix, next number (read-only once invoices exist), lead days (15 / 30 / custom), logo upload, NTN, payment accounts (§6a), JazzCash / Easypaisa number, footer note, tax on/off + rate.
- **Settings → Business → Currencies:** enabled currencies (searchable ISO 4217 picker, in-use ones locked) and the default currency for new clients (§6).

## 12. Tests

- Unit: numbering (per year, concurrency-safe), invoice window logic (`daysLeft <= leadDays`, idempotency, cancelled skipped), totals/tax rounding, template placeholders, wa.me URL builder with invoice link, money formatting per currency, token generation/validation.
- E2E (Playwright): create client + service renewing in 20 days → run check → invoice exists → share by email (dev SMTP catcher such as Mailpit, or nodemailer `jsonTransport` in test) with PDF attached → open `/i/<token>` → PDF download returns `application/pdf` → mark as paid → renewal date moved by 1 year and invoice `paid`.
