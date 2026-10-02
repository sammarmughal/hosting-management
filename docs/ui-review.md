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

The QR placeholder and mock authentication, SMTP and persistence are existing prototype boundaries, not production integrations. Documentation examples and parser test fixtures are distinguished from rendered UI when scanning content. The component styleguide intentionally demonstrates different type/button variants.

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
