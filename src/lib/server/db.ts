import "server-only"

import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { PrismaClient } from "@/generated/prisma/client"
import { mariadbConfig } from "@/lib/db-config"

// One client per server process (hot reloads in dev reuse it), with a pool
// of at most CONNECTION_LIMIT connections (db-config.ts).
//
// Created on first use, not on import: `next build` imports every route to
// read its configuration, and must work without DATABASE_URL (a host may set
// it only at runtime). The first query without it still fails with
// "DATABASE_URL is not set".
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient }

function client(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      adapter: new PrismaMariaDb(mariadbConfig(process.env.DATABASE_URL)),
    })
  }
  return globalForPrisma.prisma
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const c = client()
    const value = Reflect.get(c, prop, c)
    return typeof value === "function" ? value.bind(c) : value
  },
})

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
