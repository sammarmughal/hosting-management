# 07 — Pages, Server Actions & Route Handlers

In Next.js, **pages** are server components under `src/app`, **mutations** are Server Actions in `src/actions/*`, and **route handlers** (`app/api/*`) are used only for file downloads.

Legend: **Auth** = `public`, `pw` (password passed, 2FA pending), `full` (fully logged in).

## 1. Pages

| Path | Auth | File | Data loaded (server) |
|------|------|------|----------------------|
| `/` | any | `app/page.tsx` | redirect → `/dashboard` |
| `/login` | public | `(auth)/login/page.tsx` | — (`?expired=1` shows "Session expired") |
| `/2fa` | pw | `(auth)/2fa/page.tsx` | — |
| `/2fa/setup` | pw | `(auth)/2fa/setup/page.tsx` | creates a pending secret, QR SVG |
| `/forgot` | public | `(auth)/forgot/page.tsx` | — |
| `/reset/[token]` | public | `(auth)/reset/[token]/page.tsx` | token validity |
| `/dashboard` | full | `(app)/dashboard/page.tsx` | **runCheck()**, stats, reminder queue, due-soon list, lastCheckAt |
| `/clients` | full | `(app)/clients/page.tsx` | one row per client (docs/14 §7): `q, page` |
| `/clients/new` | full | `(app)/clients/new/page.tsx` | settings (currency); client fields only |
| `/clients/[id]` | full | `(app)/clients/[id]/page.tsx` | client, companies, subscriptions, invoices, payments, reminder log, activity (`?tab=overview|companies|subscriptions|invoices|payments`) |
| `/clients/[id]/edit` | full | `(app)/clients/[id]/edit/page.tsx` | client |
| `/companies` | full | `(app)/companies/page.tsx` | `q, client, page` (docs/14 §3) |
| `/companies/new` | full | `(app)/companies/new/page.tsx` | `?clientId=&from=client` |
| `/companies/[id]/edit` | full | `(app)/companies/[id]/edit/page.tsx` | company (`?from=client`) |
| `/service-catalog` | full | `(app)/service-catalog/page.tsx` | service types with usage (docs/14 §2) |
| `/subscriptions` | full | `(app)/subscriptions/page.tsx` | `q, filter (all/active/due/soon/green/orange/red/expired/cancelled), month (YYYY-MM), company, service, sort (days_asc/days_desc/name/renewal/charge), page` |
| `/subscriptions/new` | full | `(app)/subscriptions/new/page.tsx` | `?clientId=&companyId=`; clients, companies, active service types |
| `/subscriptions/[id]/edit` | full | `(app)/subscriptions/[id]/edit/page.tsx` | subscription |
| `/clients/[id]/services/new`, `/services/[id]/edit` | full | (redirects) | old links → the subscription pages |
| `/reminders` | full | `(app)/reminders/page.tsx` | `?tab=queue|log`, log filters `company, channel, status, from, to, q, page` |
| `/payments` | full | `(app)/payments/page.tsx` | `from, to, q, page`, totals per currency |
| `/notifications` | full | `(app)/notifications/page.tsx` | paginated list |
| `/import` | full | `(app)/import/page.tsx` | — |
| `/settings` | full | `(app)/settings/page.tsx` | `?tab=business|reminders|email|templates|security` |

All `(app)` pages use `export const dynamic = 'force-dynamic'`.

## 2. Server Actions

Every action: `'use server'` → `await requireAdmin()` (except the auth actions) → zod `safeParse` → logic → `revalidatePath(...)` → returns `ActionResult<T> = { ok: true, data?: T } | { ok: false, error: string, fieldErrors?: Record<string,string> }`.

### `actions/auth.ts`
| Action | Input | Result / effect |
|--------|-------|-----------------|
| `loginAction` | `identifier, password` | throttle check → session `password_ok` → `redirect('/2fa' | '/2fa/setup')` |
| `verifyTotpAction` | `code` | → session `full` → `redirect('/dashboard')` |
| `verifyRecoveryAction` | `recoveryCode` | same as above, and the code is consumed |
| `confirmTotpSetupAction` | `code` | enables 2FA → returns `{ recoveryCodes: string[] }` (shown once) |
| `finishSetupAction` | — | promotes the session to `full` → `/dashboard` |
| `logoutAction` | — | deletes the session → `/login` |
| `requestResetAction` | `email` | always `{ ok: true }` |
| `resetPasswordAction` | `token, password, confirm` | deletes all sessions → `/login?reset=1` |

### `actions/clients.ts`
| Action | Input | Effect |
|--------|-------|--------|
| `createClientAction` | client fields (no service, docs/14 §0) | → `redirect('/clients/{id}?saved=client')` |
| `updateClientAction` | `id` + client fields | |
| `deleteClientAction` | `id` | cascade (companies, subscriptions, …) → `redirect('/clients')` |

### `actions/companies.ts` (docs/14 §3)
| Action | Input | Effect |
|--------|-------|--------|
| `createCompanyAction` | company fields, `from` | name unique per client → back to `/companies` or the client's Companies tab |
| `updateCompanyAction` | `id` + company fields, `from` | the client can't change |
| `deleteCompanyAction` | `id` | cascades to its subscriptions, their invoices, payments and reminders |

### `actions/service-types.ts` (docs/14 §2)
`createServiceTypeAction` · `updateServiceTypeAction(id)` (names unique ignoring case) · `setServiceTypeActiveAction(id, isActive)` · `deleteServiceTypeAction(id)` (refused while any subscription uses it; the FK refuses too)

### `actions/subscriptions.ts` (docs/14 §4)
| Action | Input | Effect |
|--------|-------|--------|
| `createSubscriptionAction` | subscription fields incl. `clientId, companyId?, serviceTypeId` | company must belong to the client, type active, no active duplicate (type + identifier) → client's Subscriptions tab |
| `updateSubscriptionAction` | `id` + fields | same checks (the current type may be inactive); renewal date changed → skip the old-cycle reminders |
| `toggleCancelSubscriptionAction` | `id` | active ⇄ cancelled (reactivating is refused if it would duplicate) |
| `deleteSubscriptionAction` | `id` | |

### `actions/reminders.ts`
| Action | Input | Returns |
|--------|-------|---------|
| `checkNowAction` | — | `{ queuedNew, skipped, notificationsNew, emailsSent, emailsFailed, lastCheckAt }` |
| `getPendingEmailIdsAction` | — | `{ items: { id, name, email, domain }[] }` (for the Send-all dialog) |
| `sendReminderEmailAction` | `id` | `{ status: 'sent' | 'failed', sentAt?, error? }` |
| `markOpenedAction` | `id` | WhatsApp click |
| `markSentAction` | `id` | |
| `skipReminderAction` | `id` | |
| `sendAdminSummaryEmailAction` | — | `{ count }` |
| `adminSummaryWhatsappAction` | — | `{ url }`. The client opens the URL, and the rows are marked opened |
| `sendManualEmailAction` | `subscriptionId` | a reminder outside the stages, logged with stage = the current daysLeft |

The manual WhatsApp link for a subscription is **built on the server when the page renders** (`waLink` in the view model), so no action is needed to open it.

### `actions/payments.ts`
| Action | Input | Effect |
|--------|-------|--------|
| `renewSubscriptionAction` | `subscriptionId, amount, paidOn, method, reference?, notes?, extendFrom: 'renewal' | 'today'` | returns `{ newRenewalDate }` |
| `deletePaymentAction` | `id` | removes the record only and does **not** roll back the renewal date (shown as a warning in the confirm dialog) |

### `actions/notifications.ts`
`getLatestNotificationsAction()` → `{ unread, items }` (called when the bell opens) · `markReadAction(id)` · `markAllReadAction()`

### `actions/import.ts`
| Action | Input | Returns |
|--------|-------|---------|
| `commitImportAction` | `kind` (`clients` · `companies` · `subscriptions`), raw CSV `rows` (≤ 2,000), `updateExisting` | the rows are previewed again on the server against fresh data, in one transaction → `{ created, updated, skipped }` (docs/14 §9). The preview itself runs in the browser (`previewImport` in `src/lib/domain/import.ts`) |

### `actions/settings.ts`
`saveBusinessAction` · `saveReminderSettingsAction` (stages: integers −60…90, unique, at least one ≥ 0) · `saveEmailSettingsAction` (empty password = keep) · `sendTestEmailAction` · `saveTemplatesAction` · `resetTemplateAction(key)` · `previewTemplateAction(key, subject, body)` · `changePasswordAction(current, next, confirm, code)` · `regenerateRecoveryCodesAction(password)` · `reset2faAction(password, code)` · `revokeAllSessionsAction()`

## 3. Route handlers (downloads only, GET)

| Path | File | Notes |
|------|------|-------|
| `GET /api/export/subscriptions` | `app/api/export/subscriptions/route.ts` | CSV in the import columns + `status, days_left`, formula-injection safe, audit logged. Calls `requireAdmin()`. `/api/export/services` redirects here |
| `GET /api/export/companies` | `app/api/export/companies/route.ts` | CSV in the import columns (docs/14 §9). Calls `requireAdmin()` |
| `GET /api/export/payments?from&to` | `app/api/export/payments/route.ts` | CSV (with company and service type) |
| `GET /api/export/clients` | `app/api/export/clients/route.ts` | CSV, one row per client in the import columns + counts (Settings → Backup). Calls `requireAdmin()` |
| `GET /api/export/invoices` | `app/api/export/invoices/route.ts` | CSV, every invoice (Settings → Backup). Calls `requireAdmin()` |
| `GET /api/import/template` | `app/api/import/template/route.ts` | Empty CSV template |
| `GET /api/health` | `app/api/health/route.ts` | Public uptime check, no login: 200 `{"status":"ok","db":"ok"}`, or 503 `{"status":"error","db":"unreachable"}` when the database doesn't answer in 3 s. No data, versions or error text |
| `GET/POST /api/cron/check` | `app/api/cron/check/route.ts` | The daily check, `Authorization: Bearer <CRON_SECRET>` (docs/11 §4) |

## 4. Client-side conventions

- Forms: `<form action={serverAction}>` with `useActionState` for field errors, and `useFormStatus` for pending buttons.
- Imperative calls (queue buttons, send-all loop): `startTransition(async () => { const r = await sendReminderEmailAction(id); … })`.
- On `{ ok: false }` → show a toast with `error`. If the error is `'UNAUTHENTICATED'`, redirect to `/login?expired=1`.
- After mutations, `revalidatePath('/dashboard')`, `revalidatePath('/clients')`, and so on, so the server data refreshes. Use `router.refresh()` only when needed.
