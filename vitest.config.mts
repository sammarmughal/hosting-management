import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Real env vars win; .env fills in the rest (as in tests/global-setup.ts).
try {
  process.loadEnvFile(".env")
} catch {
  // No .env file.
}
// Integration tests need a database: without TEST_DATABASE_URL they're left
// out (not failed), so `npm test` works on a fresh checkout.
const integration = process.env.TEST_DATABASE_URL
  ? ["tests/integration/**/*.test.{ts,tsx}"]
  : []

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path("./src"),
      "server-only": path("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    // Domain tests are pure; component tests opt into jsdom per file with
    // `// @vitest-environment jsdom`.
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}", ...integration],
    // Integration tests share one test database (TEST_DATABASE_URL).
    fileParallelism: false,
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-env.ts"],
  },
})
