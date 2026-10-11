# UI quality review

Review standard: `12-DESIGN-DIRECTION.md` §§9–10, with its spacing, type, table, accessibility and mobile rules. Baseline: 2 October 2026. All five widths (360, 390, 768, 1024, 1440) were captured and each baseline image opened for inspection. Screenshots and machine measurements live in `screenshots/audit/before/`; the completed final pass is in `screenshots/audit/final/`.

## Problems → fixes

- [x] Shared shell → mobile page titles use a different type scale; navigation icons and focus treatments vary → align page titles, navigation icons and visible keyboard focus.
- [x] Shared search → `/` selects the global input before the page input → explicitly prefer the local search and provide a mobile fallback.
- [x] Dashboard / clients → tablet tables clip timers and hide actions; mobile stat labels truncate → responsive card layout when columns cannot fit, readable stat labels, consistent padding.
- [x] Client detail → 1024px two-column layout clips service dates/amounts and payment history → delay the side panel breakpoint, allow service facts to wrap and size history by its available width.
- [x] Client / service forms → section spacing differs from settings; reset date control is undersized; service edit highlights More → consistent spacing, touch targets and Clients navigation state.
- [x] Client detail → mobile action labels crowd their buttons, success-green primary competes with status, missing truncation tooltips → shorter specific labels, brand primary and full-value tooltips.
- [x] Reminders log → 1024px filter row overflows the page; search collapses to an icon → wrap filters before they become cramped.
- [x] Reminders / payments → tablet tables hide status, error and trailing actions without a useful overview → responsive cards below the usable table width; fixed columns and sticky headers for long tables.
- [x] Reminders / payments → section gaps, status badges and mobile truncation differ from shared patterns → 24px section rhythm, dot-plus-text badges, full-value tooltips and service links.
- [x] Notifications / bell → timestamps have weak contrast; rejected mark-read actions lack recovery → readable muted text and handled failures with pending feedback.
- [x] Settings → no mobile sticky Save controls; excessive bottom card padding; narrow desktop editor columns at 1024px → section-scoped sticky action bars, 16/20px card padding and later two-column breakpoint.
- [x] Settings security → recent logins clip at 768px and wrap dates awkwardly on mobile → compact responsive login rows.
- [x] Auth → card padding and title scale differ from the application → use shared 16/20px card padding and page title scale; retain the explicitly requested centred auth layout.
- [x] Error pages → card padding/title scale differ; error pages sit high in an arbitrary 60vh region → consistent centred error treatment and padding.
- [x] Shared dialogs → confirm dialog overrides the full-height mobile sheet; rejected requests escape the error UI → use the shared dialog layout and retain retryable errors.
- [x] Dashboard / queue / service actions → rejected requests can leave buttons pending indefinitely → catch errors and clear pending in finally; preserve retry paths.
- [x] Shared controls → small checkbox/switch hit areas, inconsistent link focus, off-grid layout gaps → enlarge interaction areas without enlarging glyphs; standardize layout spacing.
- [x] Admin summary → generated WhatsApp summary includes emoji status markers → use status words.
- [x] Route states → detail/form skeletons do not match their layouts; verify every list's empty/error state and every async control → add matching skeletons and exercise failures, pending and empty results.
- [x] Screenshot harness → settings reminders uses the wrong tab parameter; styleguide is intentionally disabled in production → correct the tab and capture the development-only styleguide separately.

## Completed verification

- [x] Final screenshots at all five widths, each opened and reviewed.
- [x] Keyboard: local/global search, N, typing exclusions, focus rings, dialog focus trap and Escape, menus and mobile navigation.
- [x] Mobile: no page overflow, 44px targets, bottom navigation/FAB clearance and sticky form actions.
- [x] Tables: right-aligned tabular money, tooltip truncation, hover and timer width stability.
- [x] Loading, empty, error and pending states exercised.
- [x] Code scan for forbidden styling and placeholder content.
- [x] Lint, typecheck, unit tests, browser tests and production build pass.
- [x] No unexpected browser errors or hydration warnings.

~~The QR placeholder and mock authentication, SMTP and persistence are existing prototype boundaries, not production integrations.~~ Superseded: authentication, 2FA with a real QR code, SMTP and the database are now real (October 2026). Documentation examples and parser test fixtures are distinguished from rendered UI when scanning content. The component styleguide intentionally demonstrates different type/button variants (and is disabled in production builds).

---

## Owner walkthrough: one month with invoices (10 Oct – 21 Nov 2026)

Method: the production build against the seeded database, plus a development server restarted at `FAKE_TODAY` = 12 Oct, 25 Oct, 4 Nov and 21 Nov to live through a month as the owner. Added a PKR client (Hamza Khalid, khalidprinting.pk, PKR 7,800) and a USD client (Faisal Rauf, raufexports.com, USD 120, UAE number), ran the check, received both invoices as they entered the 30-day window, shared one by email (PDF attached, caught by a local SMTP server) and one by WhatsApp, opened the public link on a 390 px phone, downloaded the PDF, marked the PKR invoice paid, and let the USD one go overdue. Screenshots: `screenshots/month/`, `screenshots/invoices/`, `screenshots/share/`. Every screen captured at 390 and 1440 px and opened for review against `12-DESIGN-DIRECTION.md` §10.

### Problems → fixes

- [x] Invoice list (390 px) → cards collapsed into one squashed row: the global mobile rule turns every un-slotted link in `main` into `inline-flex` → the card link opts out with `data-slot`.
- [x] Share dialog (390 px), Renew dialog → radio buttons rendered as 44 px circles: the mobile touch-target rule enlarged every `<button>`, including Radix radios → radios excluded like checkboxes and switches (their hit area is already enlarged).
- [x] Invoices totals strip (390 px) → three figures wrapped into an awkward bordered grid → stacked with horizontal dividers on phones.
- [x] Invoice preview → the rule above Total had a gap between label and amount (borders on two grid cells) → one row, one rule.
- [x] Invoice detail header (390 px) → "client · domain" wrapped to a dangling "· domain" → domain first.
- [x] Invoice PDF → the "Invoice" title overlapped the invoice number (line box too short) → explicit line heights.
- [x] Invoice PDF → a long bill-to name ran under the "Paid on" stamp → bill-to block limited to 62 % width so it wraps.
- [x] Invoice PDF → wrapped descriptions ended on a dangling "·" ("almadinaexports.com ·") → comma before the plan.
- [x] Invoice PDF → logo centred in its box instead of aligned with the text below → left-aligned.
- [x] Public invoice (390 px) → payment instructions broke mid-word ("Rehman Web Servic / es", IBAN split) → label above value on phones, wrapping only between words.
- [x] Public invoice (390 px) → "Invoice from Rehman Web Servic…" truncated → wraps.
- [x] Dashboard → "Check now" said "11 new reminders" but not that it had also created an invoice → the toast adds "· 1 new invoice".
- [x] Admin WhatsApp summary → emoji status markers had come back with the invoice work (regression of the fix above) → status words again ("Urgent:", "Expiring:", "Expired:").
- [x] Reminder queue → sharing an invoice by WhatsApp added a second queue item for the same service (the share was logged as a new reminder row at today's stage) → the share updates the cycle's existing reminder row.
- [x] Settings → save buttons read "Save invoice whatsapp" / "Save client whatsapp" (whole title lower-cased) → only the first letter.
- [x] Build output → `next build` copied the local `.env` (database password, APP_KEY) into `.next/standalone`, which docs/11 §3 says to zip and upload → `postbuild` removes it; `npm start` loads `./.env` instead.

### Observed, not changed (need a decision, see the hand-over summary)

- [ ] Notifications page lists up to 200 items with no paging (docs/07 says "paginated list"); a month produced 53 unread, mostly stage notifications.
- [ ] International numbers show unformatted on invoices and the client card (`+971501234567`); only Pakistani numbers are spaced.
- [ ] "Paid on" in the Renew dialog defaults to the browser's date (correct in real use; only differs under `FAKE_TODAY`).
- [ ] Invoices created before Settings → Invoices is filled in keep the old seller snapshot (no logo or payment details) by design (docs/13 §2). "Update from service" refreshes amounts only.

### Verification

- [x] Playwright e2e (docs/13 §12) passes against the standalone production build.
- [x] No console errors, CSP violations, hydration warnings or horizontal scroll on any captured page.
- [x] Lint, typecheck, unit + integration tests and production build pass.

## Final evidence and coverage

31 route/tab/data scenarios × 5 widths = 155 final screenshots. Every final image was opened individually. Baseline images were inspected in five-width sheets, with original-size follow-up for cramped layouts. [Final screenshot gallery](../screenshots/audit/final/index.html) and [machine measurements](../screenshots/audit/final/manifest.json) cover:

- Home and dashboard; clients list, new client, detail, long-name/multiple-service detail and edit.
- New/edit service; client payment, reminder-log and activity tabs.
- Reminder queue/log, payments, notifications and import.
- All five settings tabs: business, reminders, email, templates and security.
- Login, two-step verification/setup, forgot/reset password.
- 403, 419, 500, catch-all 404 and the development-only styleguide.

- [x] Long-domain payment history → a 791px natural-width table scrolled inside a 718px area at 1024px → domain-bearing tables now switch to cards below 800px of available width; recaptured and inspected all five widths.
- [x] Timer geometry → minimum width still allowed fractional movement between digit shapes → fixed-width pills with tabular numbers; bounding rectangles remain identical across timer ticks.
- [x] Programmatic renewal dialogs → Escape closed the dialog without restoring focus → restore the opening control's focus; tested Tab, Shift+Tab, Escape and restoration at every width.
- [x] Session-expired page → recovery link led to dashboard → “Sign in again” leads to login.
- [x] Email summary → a failed summary had no retry once recipient emails succeeded → expose summary retry independently.
- [x] Screenshot tooling → default caret hiding could mutate an input before delayed development hydration → preserve the caret during capture; production captures report zero hydration warnings.

Validation passed: `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd test` (197 tests across 13 files), `npm.cmd run build`, and the Playwright review scripts `review-lists.mjs`, `review-remaining.mjs`, `review-quality.mjs`. The final production capture reports zero page overflow and zero unexpected browser errors; expected 404/500 responses are checked separately. The styleguide was captured in development because production intentionally returns 404.

The browser checks cover URL filters, exports, truncation tooltips, notification actions, deletion/renewal semantics, authentication/recovery flows, import validation, settings persistence, template insertion/reset, keyboard shortcuts and typing exclusions, modal focus containment, mobile sticky actions, empty results and rejected-action pending recovery. Loading/empty/error/pending branches were also reviewed in the source. Matching skeletons now cover detail and form routes, and shared error boundaries offer Retry.

Full-page Chromium screenshots can omit offscreen sandboxed iframe paint. Separate `screenshots/audit/states/template-preview-*.png` viewport captures verify both email previews at all five widths; their frame text was verified as populated. Mobile full-page captures show fixed navigation at the original viewport boundary: scrolling clearance, rather than that composited position, determines reachability.

No new visual-design decision is required. Before a production release, replace the existing mock authentication/persistence/SMTP and QR preview with real integrations and real account/client data. Those are product implementation decisions beyond this UI polish.
