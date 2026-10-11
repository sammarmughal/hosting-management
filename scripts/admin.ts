// Shared by create-admin.ts and setup-production.ts: prompts and the rules
// for the single admin account (docs/05 §1).
import { createInterface } from "node:readline"

import { hash } from "@node-rs/argon2"
import { z } from "zod"

import type { PrismaClient } from "@/generated/prisma/client"

const COMMON = [
  "123456789012",
  "password1234",
  "passwordpassword",
  "qwertyuiop12",
  "adminadmin12",
]

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "The username needs 3+ characters")
  .max(50)
  .regex(
    /^[a-z0-9._-]+$/i,
    "Use letters, digits, dots, dashes or underscores in the username"
  )
export const emailSchema = z
  .email("Enter a valid admin email")
  .transform((e) => e.toLowerCase())

/** null when the password is acceptable, else why not. */
export function adminPasswordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters for the password."
  if (COMMON.includes(password.toLowerCase())) return "That password is too common."
  return null
}

/** Reads one line from the terminal; `hidden` echoes nothing (passwords). */
export function ask(question: string, hidden = false): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })
  if (hidden) {
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

export interface AdminInput {
  username: string
  email: string
  password: string
}

/** Prompts for username, email and password (twice). Throws on bad input. */
export async function promptAdmin(): Promise<AdminInput> {
  const username = usernameSchema.parse(await ask("Admin username: "))
  const email = emailSchema.parse(await ask("Admin email: "))
  const password = await ask("Password (12+ characters): ", true)
  const problem = adminPasswordProblem(password)
  if (problem) throw new Error(problem)
  if ((await ask("Confirm password: ", true)) !== password)
    throw new Error("Passwords do not match.")
  return { username, email, password }
}

/** Replaces any admin with this one (there is only ever one). */
export async function saveAdmin(prisma: PrismaClient, a: AdminInput) {
  await prisma.$transaction([
    prisma.admin.deleteMany(),
    prisma.admin.create({
      data: {
        username: a.username,
        email: a.email,
        passwordHash: await hash(a.password),
      },
    }),
  ])
}
