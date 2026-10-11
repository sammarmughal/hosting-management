import { fileURLToPath } from "node:url"

import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url))

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
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    // Integration tests share one test database (TEST_DATABASE_URL).
    fileParallelism: false,
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup-env.ts"],
  },
})
