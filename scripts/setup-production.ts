// npm run setup:prod [-- --env-file .env.production] [--yes]   (docs/11 §2)
//
// First-time production setup, run once from your machine (or over SSH):
//   1. checks the production environment variables,
//   2. applies the migrations (prisma migrate deploy, DIRECT_URL),
//   3. creates the single admin from ADMIN_USERNAME / ADMIN_EMAIL /
//      ADMIN_PASSWORD, or by asking in the terminal.
// It never loads demo or seed data: settings and message templates fall back
// to their built-in defaults until they're saved in the app. Safe to re-run:
// migrations already applied and an existing admin are left alone.
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"

import { PrismaPg } from "@prisma/adapter-pg"
import { z } from "zod"

import { PrismaClient } from "@/generated/prisma/client"

import {
  adminPasswordProblem,
  ask,
  emailSchema,
  promptAdmin,
  saveAdmin,
  usernameSchema,
} from "./admin"
import { adminFromEnv, describeDatabase, productionEnvProblems } from "./setup-checks"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function fail(message: string): never {
  console.error(`\n${message}`)
  process.exit(1)
}

async function main() {
  // Production values come from --env-file or the environment, never from the
  // development .env (so this can't set up the wrong database by accident).
  const envFile = arg("--env-file")
  if (envFile) {
    if (!existsSync(envFile)) fail(`Env file not found: ${envFile}`)
    process.loadEnvFile(envFile)
  }
  const interactive = process.stdin.isTTY === true

  console.log("Production setup (no demo data)\n")
  const problems = productionEnvProblems(process.env)
  if (problems.length)
    fail(`Fix these first:\n${problems.map((p) => `  - ${p}`).join("\n")}`)
  if (process.env.SEED_DEMO === "1")
    console.log("Note: SEED_DEMO is ignored here; no demo data is loaded.")

  console.log(`Database:   ${describeDatabase(process.env.DIRECT_URL)}`)
  console.log(`App URL:    ${process.env.APP_URL}`)
  if (!process.argv.includes("--yes")) {
    if (!interactive) fail("Not a terminal: re-run with --yes to confirm.")
    if ((await ask("\nSet up this database? Type yes: ")).toLowerCase() !== "yes")
      fail("Cancelled.")
  }

  console.log("\n1/2 Applying migrations…")
  // One fixed command string: npx is a .cmd on Windows, so it needs a shell.
  const migrate = spawnSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: process.env,
    shell: true,
  })
  if (migrate.status !== 0) fail("Migrations failed; nothing else was changed.")

  console.log("\n2/2 Admin account…")
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  try {
    if ((await prisma.admin.count()) > 0) {
      console.log(
        "An admin already exists; left unchanged (npm run create-admin -- --force replaces it)."
      )
    } else {
      const fromEnv = adminFromEnv(process.env)
      if (fromEnv === "partial")
        fail(
          "Set all of ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD, or none to be asked."
        )
      let admin
      if (fromEnv) {
        const problem = adminPasswordProblem(fromEnv.password)
        if (problem) fail(`ADMIN_PASSWORD: ${problem}`)
        admin = {
          username: usernameSchema.parse(fromEnv.username),
          email: emailSchema.parse(fromEnv.email),
          password: fromEnv.password,
        }
      } else {
        if (!interactive)
          fail("No admin details: set ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD.")
        admin = await promptAdmin()
      }
      await saveAdmin(prisma, admin)
      console.log(`Admin "${admin.username}" created.`)
      if (fromEnv)
        console.log("Remove ADMIN_PASSWORD from the env file / environment now.")
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log(`
Done. Next:
  - Sign in at ${process.env.APP_URL}/login and set up two-step verification.
  - Settings → Business, Email and Invoices (docs/11 §5).
  - Add the hPanel cron job for the daily check (docs/11 §4).`)
}

main().catch((err) => {
  fail(
    err instanceof z.ZodError
      ? (err.issues[0]?.message ?? "Invalid input")
      : (err.message ?? String(err))
  )
})
