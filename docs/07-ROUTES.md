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
| `/clients` | full | `(app)/clients/page.tsx` | `searchParams`: `q, filter (all/green/orange/red/expired/cancelled), month (YYYY-MM), sort (days_asc/days_desc/name/renewal/charge), page` |
| `/clients/new` | full | `(app)/clients/new/page.tsx` | settings (currency) |
| `/clients/[id]` | full | `(app)/clients/[id]/page.tsx` | client, services, payments, reminder log, activity (`?tab=`) |
| `/clients/[id]/edit` | full | `(app)/clients/[id]/edit/page.tsx` | client |
| `/clients/[id]/services/new` | full | `…/services/new/page.tsx` | client |
| `/services/[id]/edit` | full | `(app)/services/[id]/edit/page.tsx` | service |
| `/reminders` | full | `(app)/reminders/page.tsx` | `?tab=queue|log`, log filters `channel, status, from, to, q, page` |
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

### `actions/clients.ts` / `actions/services.ts`
| Action | Input | Effect |
|--------|-------|--------|
| `createClientWithServiceAction` | client fields + first service fields | → `redirect('/clients/{id}?saved=1')` |
| `updateClientAction` | `id` + client fields | |
| `deleteClientAction` | `id` | cascade → `redirect('/clients')` |
| `createServiceAction` | `clientId` + service fields | |
| `updateServiceAction` | `id` + service fields | if `renewalDate` changed → skip the old-cycle reminders |
| `toggleCancelServiceAction` | `id` | active ⇄ cancelled |
| `deleteServiceAction` | `id` | |

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
| `sendManualEmailAction` | `serviceId` | a reminder outside the stages, logged with stage = the current daysLeft |

The manual WhatsApp link for a service is **built on the server when the page renders** (`waLink` in the view model), so no action is needed to open it.

### `actions/payments.ts`
| Action | Input | Effect |
|--------|-------|--------|
| `renewServiceAction` | `serviceId, amount, paidOn, method, reference?, notes?, extendFrom: 'renewal' | 'today'` | returns `{ newRenewalDate }` |
| `deletePaymentAction` | `id` | removes the record only and does **not** roll back the renewal date (shown as a warning in the confirm dialog) |

### `actions/notifications.ts`
`getLatestNotificationsAction()` → `{ unread, items }` (called when the bell opens) · `markReadAction(id)` · `markAllReadAction()`

### `actions/import.ts`
| Action | Input | Returns |
|--------|-------|---------|
| `previewImportAction` | `FormData` with `file` | `{ rows: PreviewRow[], summary }`. The parsed rows are returned to the client (no temp storage needed on serverless) |
| `commitImportAction` | `rows` (validated again with zod on the server), `updateExisting` | `{ created, updated, skipped }` |

### `actions/settings.ts`
`saveBusinessAction` · `saveReminderSettingsAction` (stages: integers −60…90, unique, at least one ≥ 0) · `saveEmailSettingsAction` (empty password = keep) · `sendTestEmailAction` · `saveTemplatesAction` · `resetTemplateAction(key)` · `previewTemplateAction(key, subject, body)` · `changePasswordAction(current, next, confirm, code)` · `regenerateRecoveryCodesAction(password)` · `reset2faAction(password, code)` · `revokeAllSessionsAction()`

## 3. Route handlers (downloads only, GET)

| Path | File | Notes |
|------|------|-------|
| `GET /api/export/services` | `app/api/export/services/route.ts` | CSV, formula-injection safe, audit logged. Calls `requireAdmin()` |
| `GET /api/export/payments?from&to` | `app/api/export/payments/route.ts` | CSV |
| `GET /api/import/template` | `app/api/import/template/route.ts` | Empty CSV template |
| `GET /api/health` | `app/api/health/route.ts` | Public, returns `ok` (for uptime checks, no data) |

## 4. Client-side conventions

- Forms: `<form action={serverAction}>` with `useActionState` for field errors, and `useFormStatus` for pending buttons.
- Imperative calls (queue buttons, send-all loop): `startTransition(async () => { const r = await sendReminderEmailAction(id); … })`.
- On `{ ok: false }` → show a toast with `error`. If the error is `'UNAUTHENTICATED'`, redirect to `/login?expired=1`.
- After mutations, `revalidatePath('/dashboard')`, `revalidatePath('/clients')`, and so on, so the server data refreshes. Use `router.refresh()` only when needed.
