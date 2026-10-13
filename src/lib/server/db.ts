import "server-only"

import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { PrismaClient } from "@/generated/prisma/client"
import { mariadbConfig } from "@/lib/db-config"

// One client per server process (hot reloads in dev reuse it), with a pool
// of at most CONNECTION_LIMIT connections (db-config.ts).
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient }

function createClient() {
  return new PrismaClient({
    adapter: new PrismaMariaDb(mariadbConfig(process.env.DATABASE_URL)),
  })
}

export const prisma = globalForPrisma.prisma ?? createClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
