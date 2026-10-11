import "server-only"

import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "@/generated/prisma/client"

// One client per server process (hot reloads in dev reuse it). The app uses
// the pooled DATABASE_URL; migrations use DIRECT_URL (prisma.config.ts).
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient }

function createClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is not set")
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) })
}

export const prisma = globalForPrisma.prisma ?? createClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
