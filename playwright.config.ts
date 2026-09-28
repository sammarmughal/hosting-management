import { defineConfig, devices } from "@playwright/test"

// E2E smoke tests (docs/10 §1b) live in tests/e2e and arrive in Phase 9.
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
})
