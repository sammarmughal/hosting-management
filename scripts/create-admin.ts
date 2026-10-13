// npm run create-admin [-- --force]   (docs/05 §1)
// The only way to create the single admin: there is no sign-up page.
import { randomBytes } from "node:crypto"

import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { z } from "zod"

import { PrismaClient } from "@/generated/prisma/client"
import { mariadbConfig } from "@/lib/db-config"

import { ask, promptAdmin, saveAdmin } from "./admin"

try {
  process.loadEnvFile(".env")
} catch {
  // Environment only.
}

async function main() {
  if (!process.env.APP_KEY)
    console.log(
      `APP_KEY is not set. Add this to your environment:\nAPP_KEY="base64:${randomBytes(32).toString("base64")}"\n`
    )
  const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(mariadbConfig(process.env.DATABASE_URL)),
  })
  try {
    const force = process.argv.includes("--force")
    const existing = await prisma.admin.count()
    if (existing && !force) {
      console.error("An admin already exists. Use --force to replace it.")
      process.exitCode = 1
      return
    }
    if (existing) {
      const sure = await ask(
        "This deletes the current admin and all sessions. Type REPLACE: "
      )
      if (sure !== "REPLACE") return console.log("Cancelled.")
    }
    const admin = await promptAdmin()
    await saveAdmin(prisma, admin)
    console.log(
      `Admin "${admin.username}" created. Sign in and set up two-step verification.`
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err instanceof z.ZodError ? err.issues[0]?.message : (err.message ?? err))
  process.exitCode = 1
})
