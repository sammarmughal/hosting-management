import { defineConfig, devices } from "@playwright/test"

import { E2E } from "./tests/e2e/e2e-config"

// E2E (docs/10 §1b, docs/13 §12) against the production build:
//   npm run build && npm run test:e2e
// Uses a disposable database (E2E_DATABASE_URL, else TEST_DATABASE_URL) that
// the global setup migrates and wipes, and a local SMTP catcher.
try {
  process.loadEnvFile(".env")
} catch {
  // Environment only.
}

const baseURL = `http://localhost:${E2E.port}`

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    // The standalone server (docs/11 §3); `npm run build` must have run.
    command: "node .next/standalone/server.js",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E.databaseUrl(),
      APP_URL: baseURL,
      // The production server refuses a localhost APP_URL unless told it's a local run.
      ALLOW_LOCAL_APP_URL: "1",
      CRON_SECRET: "",
      PORT: String(E2E.port),
      HOSTNAME: "localhost",
      APP_KEY: process.env.APP_KEY ?? "",
      SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME ?? "hrm_session",
      // Made-up Google client: the button and the redirect can be tested, the
      // Google side can't. Password login stays on for the other specs.
      GOOGLE_CLIENT_ID: "e2e-test-client.apps.googleusercontent.com",
      GOOGLE_CLIENT_SECRET: "e2e-test-secret",
      ADMIN_EMAILS: "abdulrehmaan060@gmail.com",
      PASSWORD_LOGIN_ENABLED: "1",
    },
  },
})
