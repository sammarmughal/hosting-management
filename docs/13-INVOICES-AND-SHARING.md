# 13 — Invoices, sharing, currency and going functional

This file covers the client's feedback after the UI demo. The UI is approved as is. The work now is to make it fully functional and to add invoices.

Priority of docs: on invoices, sharing and currency, **this file wins**. On visuals, `12-DESIGN-DIRECTION.md` still wins. Everything else stays as defined in `01`–`11`.

## 0. What the client asked for

1. Make the existing UI properly functional (real data, real emails, real reminders). No redesign.
2. Currency handling (see §6; confirm the exact requirement with the client).
3. Send a reminder to the customer on **both email and WhatsApp with a single click**.
4. Create a proper **invoice** for every renewal. It is sent along with the reminder on email and WhatsApp, and can be **downloaded as a PDF**.
5. The invoice must be available in the system **30 or 15 days before the renewal date** (configurable).
6. A **Share invoice** button that asks "WhatsApp or Email". The client's WhatsApp number or email is picked up automatically from the client record.

## 1. Important constraint: WhatsApp

A `wa.me` link can only open WhatsApp with **pre-filled text**. It cannot attach a PDF and cannot send by itself; the owner still presses Send inside WhatsApp. So:

- **Now (free, no approval needed):** the WhatsApp message contains a **secure invoice link** (`https://<app>/i/<token>`). The customer taps it, sees the invoice and downloads the PDF. Email gets the PDF as a real attachment plus the same link.
- **Later (optional):** WhatsApp Business Cloud API (Meta) can send the PDF itself fully automatically. It needs Meta business verification, an approved message template with a document header, and has per-conversation cost. Build sending behind a `WhatsAppProvider` interface with a `link` implementation now, so a `cloud` implementation can be added later without touching the UI.

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
- `seller` (JSON snapshot of business details at issue time), so editing settings later never changes old invoices
- `notes`
- `publicToken` (32 random bytes, URL-safe), `publicTokenRevokedAt`
- `firstSentAt`, `paidAt`, `paymentId`, `voidedAt`, `createdAt`, `updatedAt`
- Unique constraint on `(serviceId, periodStart)` so each renewal cycle has exactly one invoice.

`InvoiceItem`: `invoiceId`, `description` (e.g. "Hosting renewal — noordental.pk"), `periodLabel` ("30 Sep 2026 → 30 Sep 2027"), `quantity`, `unitAmount`, `amount`.

`InvoiceEvent` (or reuse the activity log): `created`, `email_sent`, `email_failed` (with error), `whatsapp_opened`, `whatsapp_marked_sent`, `link_viewed`, `pdf_downloaded`, `paid`, `voided`, `link_regenerated`.

## 3. Numbering

- Format `{prefix}-{YYYY}-{seq}`, seq zero-padded to 4 digits. Prefix from settings, default `INV`.
- Sequence is per year, allocated inside a DB transaction (counter row with a lock, or equivalent). Numbers are never reused; a voided invoice keeps its number.

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

> TODO: confirm with the client exactly what was asked ("jo currency wala main ne bola hai"). Default implementation below.

- Each service has its own currency. Settings has an enabled-currencies list (default PKR, USD, AED, SAR, GBP, EUR) and a default currency for new services.
- Invoices use the service's currency.
- Totals are **grouped per currency everywhere** (dashboard stat "Expected in 30 days", payments summary strip, invoice list). Different currencies are never added together. No exchange-rate conversion unless the client asks.
- Formatting through `money.ts`: `PKR 6,500`, `USD 49.99` (no decimals when .00).

## 7. Invoice PDF

- Generated server-side with `@react-pdf/renderer` (pure Node, no headless browser, works with the standalone build). Generated on demand; no PDF files stored on disk.
- Routes: `GET /api/invoices/[id]/pdf` (authenticated) and `GET /i/[token]/pdf` (public). `Content-Disposition` filename: `Invoice-INV-2026-0012-noordental.pk.pdf`.
- A4, one page for normal invoices. Fonts: Geist (register TTF files; if the `geist` package only ships woff2, add the TTF files under `src/assets/fonts`).
- Layout, top to bottom:
  1. Logo + business name, address, phone, email, NTN (optional) on the left; "Invoice" title, number, issue date, due date and status on the right.
  2. "Bill to": client name, company, email, phone.
  3. Items table: Description, Period, Qty, Amount (right-aligned, tabular).
  4. Totals: Subtotal, Discount (if any), Tax (if any), **Total** with currency.
  5. Payment instructions from settings (bank name, account title, account number / IBAN, JazzCash / Easypaisa number).
  6. Footer note from settings (e.g. "Please pay before the due date to avoid service interruption.").
- Same visual rules as `12` (neutral, hairlines, brand colour only for the title/accents, no gradients, no emoji).

## 8. Public invoice page `/i/[token]`

- No login. `noindex`. Shows the invoice as HTML in the same design, with a "Download PDF" button and the payment instructions.
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
- New template placeholders: `{{invoice_number}}`, `{{invoice_link}}`, `{{invoice_total}}`, `{{due_date}}`. A new template "Invoice" (email subject + body, WhatsApp body) in Settings → Templates.
- Reminder queue rows: a new primary per-row action **"Send email + WhatsApp"** (single click, as in §9 "Both"), and an invoice chip ("INV-2026-0012 · Unpaid") that opens the invoice.
- Bulk "Send N emails" stays as is for email. For WhatsApp in bulk, a **WhatsApp queue** dialog steps through the list: "1 of 5 · Ali Khan · Open WhatsApp" → Next. (Browsers block opening many tabs at once, and each message still needs Send pressed in WhatsApp.)

## 11. Screens to add or change

- **Nav:** add "Invoices" between Reminders and Payments (icon `FileText`).
- **/invoices:** header "Invoices" + count; filters: status (All · Unpaid · Overdue · Paid · Void), search, date range, currency, all in URL params. Table: Number (mono), Client (2 lines), Domain, Issue date, Due date, Amount (right), Status badge, ⋯ (View, Download PDF, Share, Copy link, Mark as paid, Void). Totals strip per currency. Mobile cards. Empty + loading states.
- **/invoices/[id]:** the invoice preview (same as the public page) on the left; on the right an actions panel (Share as the one primary button, Download PDF, Copy link, Mark as paid, Update from service, Regenerate link, Void) and the event timeline.
- **Client detail:** an "Invoices" tab; each service card shows the current-cycle invoice chip and a Share invoice button.
- **Dashboard:** queue rows get the invoice chip and "Send email + WhatsApp".
- **Settings → Invoices** (new section): prefix, next number (read-only once invoices exist), lead days (15 / 30 / custom), logo upload, NTN, payment instructions fields, footer note, tax on/off + rate.
- **Settings → Currency** (new section or part of Business): enabled currencies, default currency.

## 12. Tests

- Unit: numbering (per year, concurrency-safe), invoice window logic (`daysLeft <= leadDays`, idempotency, cancelled skipped), totals/tax rounding, template placeholders, wa.me URL builder with invoice link, money formatting per currency, token generation/validation.
- E2E (Playwright): create client + service renewing in 20 days → run check → invoice exists → share by email (dev SMTP catcher such as Mailpit, or nodemailer `jsonTransport` in test) with PDF attached → open `/i/<token>` → PDF download returns `application/pdf` → mark as paid → renewal date moved by 1 year and invoice `paid`.
