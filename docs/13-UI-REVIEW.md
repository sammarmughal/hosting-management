# Remaining screens: implementation and review

Auth, import, settings and error screens follow `06-UI-SPEC.md` and the visual direction in `12-DESIGN-DIRECTION.md`. This remains the Phase 1 mock-backed app; authentication, SMTP delivery, password changes, session revocation and recovery-code consumption are not production implementations.

## Implemented

- Shared centred auth layout; sign-in, password visibility, credential errors, password reset forms and neutral confirmations.
- Shared six-box OTP input with numeric keyboard, auto-advance, arrow/backspace navigation and full-code paste. Recovery-code mode and three-step setup with the requested QR placeholder, manual-key copying, eight recovery codes, text download and saved-code gate.
- Papa Parse CSV preview, file extension/2 MB checks, header validation, row errors and warnings, existing-domain handling, valid-row counts, pagination and mock import. Dates accept ISO or DD/MM/YYYY. Missing renewal dates become start + one year. Commit revalidates rows and groups matching client names and contact details.
- Settings navigation in URL parameters, vertical desktop tabs and a mobile select. Separate dirty-state saves, validated reminder limits/stages, live status ranges, SMTP saved-password indication and mock test email.
- Four template editors with cursor insertion, default restoration and section-aware previews through the existing template renderer. Email HTML is isolated in sandboxed, script-disabled previews. Each template saves independently.
- Password-change form, guarded recovery regeneration/reset flows, logout confirmation and recent logins. Shared not-found and error cards, plus 403/419/500 views.

## Visual review against §10

Captured all routes at 390 and 1440 pixels, plus intermediate/error states. Also checked page overflow at 360 pixels. The review retained neutral surfaces, hairline borders, Geist type, restrained status colours, small headings and consistent controls.

Fixes from the review:

- Mobile import rows now expose status and explanation without sideways scrolling; desktop retains the preview table.
- Recent-login IP addresses sit beneath devices on mobile.
- Mobile inputs/buttons use 44px touch targets; OTP spacing also fits at 360px.
- Invalid CSV dates no longer reach the date formatter.
- Error views share the same centred card and dashboard link.
- Email previews have additional detail captures because full-page browser screenshots can omit off-screen sandboxed iframe contents.

Screenshots are local generated artifacts under `screenshots/` (intentionally gitignored).

| Screen | 390px | 1440px |
| --- | --- | --- |
| Login | [Mobile](../screenshots/login-390.png) | [Desktop](../screenshots/login-1440.png) |
| Two-step verification | [Mobile](../screenshots/2fa-390.png) | [Desktop](../screenshots/2fa-1440.png) |
| Setup: scan | [Mobile](../screenshots/2fa-setup-390.png) | [Desktop](../screenshots/2fa-setup-1440.png) |
| Setup: verify | [Mobile](../screenshots/2fa-setup-verify-390.png) | [Desktop](../screenshots/2fa-setup-verify-1440.png) |
| Setup: recovery codes | [Mobile](../screenshots/2fa-setup-recovery-codes-390.png) | [Desktop](../screenshots/2fa-setup-recovery-codes-1440.png) |
| Forgot password | [Mobile](../screenshots/forgot-390.png) | [Desktop](../screenshots/forgot-1440.png) |
| Reset password | [Mobile](../screenshots/reset-preview-390.png) | [Desktop](../screenshots/reset-preview-1440.png) |
| Import: upload | [Mobile](../screenshots/import-390.png) | [Desktop](../screenshots/import-1440.png) |
| Import: preview | [Mobile](../screenshots/import-preview-390.png) | [Desktop](../screenshots/import-preview-1440.png) |
| Import: done | [Mobile](../screenshots/import-done-390.png) | [Desktop](../screenshots/import-done-1440.png) |
| Business | [Mobile](../screenshots/settings-390.png) | [Desktop](../screenshots/settings-1440.png) |
| Reminders | [Mobile](../screenshots/settings-tab-reminders-390.png) | [Desktop](../screenshots/settings-tab-reminders-1440.png) |
| Email | [Mobile](../screenshots/settings-tab-email-390.png) | [Desktop](../screenshots/settings-tab-email-1440.png) |
| Templates | [Mobile](../screenshots/settings-tab-templates-390.png) | [Desktop](../screenshots/settings-tab-templates-1440.png) |
| Security | [Mobile](../screenshots/settings-tab-security-390.png) | [Desktop](../screenshots/settings-tab-security-1440.png) |
| Not found | [Mobile](../screenshots/missing-page-390.png) | [Desktop](../screenshots/missing-page-1440.png) |
| Error boundary | [Mobile](../screenshots/error-boundary-390.png) | [Desktop](../screenshots/error-boundary-1440.png) |
| Access denied | [Mobile](../screenshots/403-390.png) | [Desktop](../screenshots/403-1440.png) |
| Session expired | [Mobile](../screenshots/419-390.png) | [Desktop](../screenshots/419-1440.png) |
| Server error | [Mobile](../screenshots/500-390.png) | [Desktop](../screenshots/500-1440.png) |

Additional captures include login errors, recovery-code mode, reset confirmations, upload validation errors, security confirmation dialogs and each email preview.

## Reproduce

Run the local dev server, then `node scripts/review-remaining.mjs`. It captures the views and checks auth transitions, OTP paste/advance, recovery-code download/gating, CSV validation/commit, setting persistence, independent saves, placeholder insertion, default reset and dialog Escape handling. It writes only to the disposable in-memory mock data. Restart the server to reset imported records and preferences.

The real error-boundary screenshots were captured using a temporary throwing route, removed after review. The intentional 404 and 500 pages produce expected HTTP error responses; these are distinguished from unexpected runtime, console or hydration errors.

Mock fixtures: identifier `rehman` (or `billing@rehmanweb.pk`), password `Renewals2026!`, authenticator code `123456`, recovery code `A1B2-C3D4`. `/reset/preview` exercises the success flow; `/reset/expired` exercises the expired-link message. Generated recovery codes and the displayed QR key are UI fixtures, not active authentication secrets.

Validation passed: `npm run lint`, `npm run typecheck`, `npm run test` (197 tests), `npm run build`, and the browser review script at both widths. The earlier reminders/payments/notifications browser checks also passed, including payment deletion without changing the renewal date.
