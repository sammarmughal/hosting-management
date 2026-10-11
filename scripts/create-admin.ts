// npm run create-admin [-- --force]   (docs/05 §1)
// The only way to create the single admin: there is no sign-up page.
import { randomBytes } from "node:crypto"
import { createInterface } from "node:readline"

import { hash } from "@node-rs/argon2"
import { PrismaPg } from "@prisma/adapter-pg"
import { z } from "zod"

import { PrismaClient } from "@/generated/prisma/client"

try {
  process.loadEnvFile(".env")
} catch {
  // Environment only.
}

const COMMON = ["123456789012", "password1234", "passwordpassword", "qwertyuiop12", "adminadmin12"]

function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  if (hidden) {
    // Echo nothing while the password is typed.
    const out = rl as unknown as { _writeToOutput: (s: string) => void }
    out._writeToOutput = (s) => {
      if (s.includes(question)) process.stdout.write(s)
    }
  }
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close()
      if (hidden) process.stdout.write("\n")
      resolve(answer.trim())
    })
  )
}

async function main() {
  if (!process.env.APP_KEY)
    console.log(
      `APP_KEY is not set. Add this to your environment:\nAPP_KEY="base64:${randomBytes(32).toString("base64")}"\n`
    )
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
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
      const sure = await ask("This deletes the current admin and all sessions. Type REPLACE: ")
      if (sure !== "REPLACE") return console.log("Cancelled.")
    }
    const username = z.string().min(3).max(50).regex(/^[a-z0-9._-]+$/i).parse(await ask("Username: "))
    const email = z.email().parse((await ask("Email: ")).toLowerCase())
    const password = await ask("Password (12+ characters): ", true)
    if (password.length < 12 || COMMON.includes(password.toLowerCase()))
      throw new Error("Use at least 12 characters and avoid common passwords.")
    if ((await ask("Confirm password: ", true)) !== password)
      throw new Error("Passwords do not match.")

    await prisma.$transaction([
      prisma.admin.deleteMany(),
      prisma.admin.create({ data: { username, email, passwordHash: await hash(password) } }),
    ])
    console.log(`Admin "${username}" created. Sign in and set up two-step verification.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err instanceof z.ZodError ? err.issues[0]?.message : err.message ?? err)
  process.exitCode = 1
})
