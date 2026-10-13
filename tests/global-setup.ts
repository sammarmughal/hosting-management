import { execSync } from "node:child_process"

/** Applies the migrations to the test database once per run (if one is configured). */
export default function setup() {
  try {
    process.loadEnvFile(".env")
  } catch {
    // Environment only.
  }
  const url = process.env.TEST_DATABASE_URL
  if (!url) {
    console.warn("TEST_DATABASE_URL is not set: integration tests will be skipped.")
    return
  }
  execSync("npx prisma migrate deploy", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: url },
  })
}
