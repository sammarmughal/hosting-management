// npm run reset-2fa   (docs/05 §9: emergency, needs database access)
// Turns two-step verification off and ends all sessions, so it is set up
// again at the next sign-in.
import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"

try {
  process.loadEnvFile(".env")
} catch {
  // Environment only.
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  })
  try {
    const { count } = await prisma.admin.updateMany({
      data: { totpEnabled: false, totpSecretEnc: null, totpLastStep: null, recoveryCodes: [] },
    })
    await prisma.session.deleteMany()
    await prisma.auditLog.create({ data: { action: "2fa.reset", details: { via: "cli" } } })
    console.log(count ? "2FA reset. Set it up again at the next sign-in." : "No admin found.")
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
