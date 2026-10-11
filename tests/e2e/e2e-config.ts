import path from "node:path"

// Shared by playwright.config.ts, the global setup and the specs.
export const E2E = {
  port: 3200,
  smtpPort: 2526,
  username: "e2e-admin",
  password: "E2E-admin-password-2026",
  /** Known base32 secret, so the spec can generate TOTP codes (docs/10 §1b). */
  totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  mailbox: path.resolve("test-results", "e2e-mailbox.jsonl"),
  /** A disposable database; never the dev one. */
  databaseUrl: () => process.env.E2E_DATABASE_URL || process.env.TEST_DATABASE_URL || "",
}
