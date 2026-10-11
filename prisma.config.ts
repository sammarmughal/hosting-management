// Prisma 7 CLI config: migrations use the direct (non-pooled) URL (docs/11 §1).
import { defineConfig, env } from "prisma/config"

// Prisma 7 no longer reads .env itself. Real env vars (hPanel, CI) win.
try {
  process.loadEnvFile(".env")
} catch {
  // No .env file: rely on the environment.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url: env("DIRECT_URL") },
})
