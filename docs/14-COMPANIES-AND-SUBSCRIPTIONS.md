# 14 — Companies, Service Catalog and Subscriptions

This file covers the client's Phase 2 request (25 Oct 2026). One client (the person who pays) can own several companies, and every company can have several subscriptions. A subscription can also sit directly under the client, with no company. What is sold comes from a **Service Catalog** the owner edits in the app, instead of everything being "hosting".

Priority of docs: on clients, companies, the catalog, subscriptions and everything listed below, **this file wins**. On visuals, `12-DESIGN-DIRECTION.md` still wins. Everything else stays as defined in `01`–`13`. Where older docs say "service" for the thing that renews, read "subscription".

## 0. What the client asked for

1. **Add client** holds customer info only: name, email, phone/WhatsApp, default currency, billing address, notes. The hosting service section leaves this form.
2. **Companies:** parent client, company name, email (optional), phone (optional), billing address (optional; owner decision 25 Oct 2026). List, add, edit, delete. Delete asks for confirmation and says what else will be deleted.
3. **Service Catalog**, fully editable: name, default price (optional), active/inactive. Starts with Domain Registration, Web Hosting, Domain and Hosting, Website Maintenance, AMC. A type used by any subscription can't be deleted, only deactivated, and a tooltip says why. All billing is **yearly**; no monthly cycles yet, but the code keeps the cycle in one place.
4. **Subscriptions** replace "services": client (required), company (optional, only that client's companies, checked on the server), service type (active ones only), domain or identifier, hosting plan (optional), start date, renewal date (start + 1 year by default), renewal charge, currency (from the client), reminders on/off. One renewal date per subscription.
5. **Sidebar:** Dashboard, Clients, Companies, Service Catalog, Subscriptions, Reminders, Invoices, Payments, Import, Settings.
6. **Client page tabs:** Overview, Companies, Subscriptions, Invoices, Payments.
7. **Invoices:** one per subscription per renewal cycle (as today). Bill-to is the client; under the client's name the invoice shows the company and its details when the subscription belongs to one. The company also shows in the invoice list, PDF, public page and email. The payment account is still chosen by currency (docs/13 §6a).
8. **Reminders** go to the client's email and WhatsApp, never to the company contact. The company name and the domain are in the text. New placeholder `{{company_name}}`.
9. Dashboard, reminder queue, invoices and search show and filter by company where useful.
10. **CSV import and export** for clients, companies and subscriptions.
11. Production holds only a test client the owner deletes first, so no data migration is needed, but the migration must still run safely on the live database. The phpMyAdmin SQL for Hostinger contains only the new migration.

**Owner decisions (25 Oct 2026):** full rename of "service" to "subscription" in code and database; company billing address optional; duplicates checked per service type + identifier; add `{{service_name}}` and reword the "hosting" defaults.

**Not in this phase:** monthly or other cycles, one payment split across several invoices, several expiry dates inside one subscription.

## 1. Data model

`ServiceType` (`service_types`)
- `id`, `name` (unique, up to 100 characters), `defaultPrice` (`Decimal(15,3)`, optional), `isActive` (default true), `position` (list order), `createdAt`, `updatedAt`.
- The default price has no currency. It only pre-fills the charge on a new subscription, in that subscription's currency.

`Company` (`companies`)
- `id`, `clientId` (deleting the client deletes its companies), `name` (up to 150), `email`, `phone` (normalised digits, like clients), `address` (all optional), `createdAt`, `updatedAt`.
- A client can't have two companies with the same name (`@@unique([clientId, name])`).

`Subscription` (`subscriptions`, was `services`)
- Everything the service had: `clientId`, `domain`, `planLabel`, `startDate`, `renewalDate`, `chargeAmount`, `currency`, `status` (`active` | `cancelled`), `remindersEnabled`, `notes`.
- New: `companyId` (optional; deleting the company deletes its subscriptions) and `serviceTypeId` (required; **the database refuses** to delete a type that is in use).
- `domain` holds the domain **or another identifier** (e.g. "AMC 2026 – Head office"). Something that looks like a domain is normalised as before (lower case, no `https://`, no `www.`); anything else is trimmed, 2–190 characters.

`Client`
- Loses the free-text `company` column (companies are now records). `currency` is the client's **default currency**: new subscriptions start in it.

Renamed columns: `service_id` becomes `subscription_id` on `payments`, `reminders`, `notifications` and `invoices`. The keys keep their meaning: one invoice per `(subscription_id, period_start)`, one reminder per `(subscription_id, cycle_date, stage, channel, recipient)`.

**Billing cycle:** `src/lib/domain/cycles.ts` has `type BillingCycle = "yearly"` and `nextRenewal(date, cycle)`. Renewing, the invoice period and the form's default renewal date all go through it. Adding monthly later means one more value there and a column on `subscriptions`; nothing else is built now.

## 2. Service Catalog (`/service-catalog`)

- A table: name, default price (or "—"), status (Active / Inactive), and how many subscriptions use it.
- **Add** and **Edit** open a dialog (a full-screen sheet on mobile) with name, default price and an Active switch. Names are unique, ignoring letter case.
- **Deactivate** hides the type from the subscription form and the import; existing subscriptions keep it and keep renewing.
- **Delete** works only when no subscription uses the type. Otherwise the button is disabled, and its tooltip says: "Used by 3 subscriptions, so it can't be deleted. Deactivate it to hide it from new subscriptions." The server refuses it too.
- The migration inserts the five defaults (Domain Registration, Web Hosting, Domain and Hosting, Website Maintenance, AMC), active, with no default price. Production never runs the seed, so they must come from the migration.

## 3. Companies (`/companies`)

- List: company name, client, email or phone, number of subscriptions, next renewal. Search (company, client, email) and a client filter. On mobile, cards.
- `/companies/new?clientId=` (client picked from a select when not given) and `/companies/[id]/edit`.
- **Delete** uses the confirm dialog. Its text counts what goes with it: "Delete Noor Dental Clinic? This deletes 2 subscriptions, 3 invoices, 1 payment and their reminders. This can't be undone." With nothing under it: "This deletes the company. This can't be undone."
- A company's phone and email are shown on invoices only. Reminders never go to them (§6).

## 4. Subscriptions (`/subscriptions`)

**Form** (`/subscriptions/new?clientId=&companyId=`, `/subscriptions/[id]/edit`)
- **Client** (required). Changing it clears the company and resets the currency to the new client's.
- **Company** (optional): only the chosen client's companies, plus "No company". The server checks the company belongs to the client.
- **Service** (required): active catalog types only. When editing, the current type stays selectable even if it was deactivated since.
- **Domain / identifier** (required, §1).
- **Hosting plan** (optional, the old plan label).
- **Start date** and **renewal date**. The renewal date follows start + 1 year until it is edited by hand (as today); it must be after the start date.
- **Renewal charge** with the currency select. Picking a service type with a default price fills the charge when it is empty.
- **Currency** starts as the client's default currency (docs/13 §6).
- **Send reminders** switch, **Notes**.
- **Duplicates:** the same identifier can't be used twice for the same service type, ignoring cancelled subscriptions and letter case ("abc.com already has an active Web Hosting subscription"). Domain Registration and Web Hosting for the same domain are fine.

**List** is the old services list from `/clients`, unchanged in behaviour (status chips, month, sort, paging), plus a Company column (under the client name on mobile cards), a Service column, and **Company** and **Service** filters.

Renew, cancel, delete, create invoice now and reminders work exactly as they did for services.

Old links `/clients/[id]/services/new` and `/services/[id]/edit` redirect to the new pages.

## 5. Invoices

- Still one invoice per subscription per renewal cycle, created the same way (docs/13 §4).
- **Line item:** "Web Hosting — abc.com", with ", Business plan" when there is a plan. The service type name replaces the old fixed "Hosting renewal".
- **Bill-to snapshot** (`billTo`): `name`, `email`, `phone`, `address` of the client, plus `company`: `{ name, email, phone, address }` when the subscription belongs to a company, otherwise `null`. Invoices issued before this change stored the company as a plain string; it is read as `{ name }`.
- **On the page, the PDF and the public page:** under "Bill to" the client's name, then the company name in bold and the company's email, phone and address (whatever is filled in), then the client's own contact lines.
- **Invoice list:** a Company column (under the client on mobile) and a Company filter; search matches the company name. The CSV export gains `company`.
- "Update from subscription" (was "Update from service") also refreshes the bill-to snapshot on unpaid invoices, so a company added afterwards shows up.
- Payment account: unchanged, chosen by the invoice's currency.

## 6. Reminders and templates

- **Who gets them:** unchanged. The client's email and WhatsApp number, and the admin. Never the company's email or phone.
- **New placeholders** (docs/08), usable in every client and invoice template:
  - `{{company_name}}`: the company's name, or empty when the subscription has none. The old `{company}` keeps working and means the same.
  - `{{company_line}}`: " (Noor Dental Clinic)" with a leading space and brackets, or empty. Made for putting straight after the domain.
  - `{{service_name}}`: the catalog name, e.g. "Web Hosting".
- **Default templates** lose the word "hosting". For example the client email now says: "This is a friendly reminder that your Web Hosting for **noordental.pk** (Noor Dental Clinic) will expire on **30 Sep 2026** (in 7 days)." Templates already saved in Settings are not changed; "Reset to default" brings the new wording.
- The **admin summary** (email table and WhatsApp list) shows the service and the company next to the domain.
- Settings → Templates lists the new placeholders as insert buttons.

## 7. Screens

- **Nav:** Dashboard, Clients, Companies, Service Catalog, Subscriptions, Reminders, Invoices, Payments, Import, Settings. The mobile bottom bar is Dashboard, Subscriptions, Reminders, More.
- **`/clients`:** a real client list now (one row per client): name, email and phone, number of companies, active subscriptions, and the next renewal as a timer pill. Search, paging, cards on mobile.
- **`/clients/new`, `/clients/[id]/edit`:** client fields only (name, email, WhatsApp phone, default currency, billing address, notes). After saving a new client, its page opens with "Add company" and "Add subscription" ready.
- **`/clients/[id]`:** header with the client name and actions; tabs **Overview** (contact card, counts, next renewals, recent activity and reminder log), **Companies** (cards with edit/delete and "Add company"), **Subscriptions** (subscription cards grouped by company, then "No company", with "Add subscription"), **Invoices**, **Payments**. The tab is kept in `?tab=`.
- **Dashboard:** stat cards link to `/subscriptions?filter=…`. "Due soon" and the reminder queue show the service and the company. The queue has a company filter.
- **Reminder log, payments:** show the company; the log has a company filter.
- The floating "+" button and the "N" shortcut open "Add subscription" on the dashboard and the subscriptions list, and "Add client" on the clients list.

## 8. Search and filters

- The top search opens `/subscriptions?q=` and matches the domain, client name, company name, service type, client email and phone.
- Company filters take a company id (`?company=12`) and list companies as "Company — Client".
- Filters are parsed in `src/lib/subscription-filters.ts` and `src/lib/list-filters.ts`, with whitelists, as before.

## 9. CSV import and export

`/import` asks what is being imported. Each type has a template download, the same preview (errors block a row, warnings don't) and an "Update existing" switch. Import in this order: clients, then companies, then subscriptions. Dates may be `YYYY-MM-DD` or `DD/MM/YYYY`.

| File | Columns | Matched by |
|---|---|---|
| clients.csv | `name, email, phone, address, currency, notes` | name + (email or phone) |
| companies.csv | `client_name, client_email, client_phone, company_name, email, phone, address` | client must exist; then client + company name |
| subscriptions.csv | `client_name, client_email, client_phone, company_name, service_type, domain, plan_label, start_date, renewal_date, charge_amount, currency, reminders, notes` | client must exist; the company (if given) must exist under it; the service type must exist and be active; then service type + identifier |

- A client is found by name plus email or phone (the same rule as today).
- `renewal_date` empty: start + 1 year, with a warning. `currency` empty: the client's currency. `reminders`: `yes`/`no`/empty (yes).
- **Exports** (`/api/export/clients`, `/companies`, `/subscriptions`) use the same columns, so an export imports back unchanged. Subscriptions add `status` and `days_left` at the end (ignored on import). The invoices and payments exports gain a `company` column.

## 10. Migration and deploy

- One migration, `companies_subscriptions`. It **renames** (`RENAME TABLE`, `RENAME COLUMN`, `RENAME INDEX`, foreign keys dropped and re-added under the new names), so existing rows survive. It:
  1. creates `service_types` and inserts the five defaults,
  2. creates `companies`,
  3. renames `services` to `subscriptions` and every `service_id` to `subscription_id`,
  4. adds `service_type_id` (existing rows get "Web Hosting") and `company_id`,
  5. turns each non-empty `clients.company` into a company of that client and moves its subscriptions under it, then drops the column.
- It works on an empty database and on one with data. `prisma migrate diff` against the schema shows no difference afterwards.
- **Hostinger without SSH:** `node scripts/phpmyadmin-setup.mjs --only <migration>` writes `production-update-<migration>.sql` with just that migration and its `_prisma_migrations` row. Take a backup (phpMyAdmin → Export), import the file, then deploy the new code (docs/11 §8).

## 11. Tests

**Unit:** client, company, service type and subscription validation; `nextRenewal`; the catalog delete guard; the company delete text; the invoice line; the bill-to snapshot with and without a company (and old string snapshots); `{{company_name}}`, `{{company_line}}`, `{{service_name}}` and the `{company}` alias; the admin summary with company; the three CSV previews; the filter parsers; the nav order; the export headers.

**Integration:** another client's company is refused; an inactive type is refused (except the subscription's own); the duplicate rule; a used type can't be deleted (action and database); deleting a company deletes what the dialog counted; invoices carry the company; reminders go only to the client's contacts and the text names the company and domain; importing the three CSVs; the migration moves a legacy client's company text and service.

**E2E:** add client → add company → add subscription under it → Check now → the invoice shows the company on the page and the public page → PDF downloads → the used catalog type can't be deleted (tooltip) → deleting the company lists what goes with it. The invoice-flow and currency specs add the subscription separately from the client; the backup CSV headers are checked.
