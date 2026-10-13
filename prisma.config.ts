// Prisma 7 CLI config: migrations use DATABASE_URL (MySQL/MariaDB, docs/11 §1).
import { defineConfig } from "prisma/config"

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
  // Optional here, unlike env("DATABASE_URL"), which throws when it's unset:
  // `prisma generate` (npm ci's postinstall) needs no database, so a fresh
  // checkout or a host that sets the variable only at runtime can install.
  // Commands that connect (migrate, db seed) still stop with Prisma's own
  // "datasource.url is required" error, and the app and scripts with
  // "DATABASE_URL is not set" (src/lib/db-config.ts).
  datasource: { url: process.env.DATABASE_URL?.trim() || undefined },
})
