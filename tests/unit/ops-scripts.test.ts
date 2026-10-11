// The pure parts of scripts/setup-production.ts and scripts/backup-db.ts.
import { describe, expect, it } from "vitest"

import { backupFileName, libpqUrl } from "../../scripts/backup-name"
import {
  adminFromEnv,
  describeDatabase,
  productionEnvProblems,
} from "../../scripts/setup-checks"

const GOOD = {
  DATABASE_URL: "postgresql://u:secret@ep-x-pooler.aws.neon.tech/hrm?sslmode=require",
  DIRECT_URL: "postgresql://u:secret@ep-x.aws.neon.tech/hrm?sslmode=require",
  APP_KEY: `base64:${Buffer.alloc(32, 7).toString("base64")}`,
  APP_URL: "https://renewals.abdulrehmaan.net",
  CRON_SECRET: "a".repeat(64),
}

describe("setup:prod environment checks", () => {
  it("accepts a complete production environment", () => {
    expect(productionEnvProblems(GOOD)).toEqual([])
  })
  it("lists every missing or wrong value", () => {
    const problems = productionEnvProblems({
      DATABASE_URL: "mysql://x",
      APP_KEY: "short",
      APP_URL: "http://localhost:3000",
      CRON_SECRET: "abc",
      ALLOW_LOCAL_APP_URL: "1",
    })
    expect(problems).toHaveLength(6)
    expect(problems.join("\n")).toMatch(/DATABASE_URL must be a postgresql/)
    expect(problems.join("\n")).toMatch(/DIRECT_URL is not set/)
    expect(problems.join("\n")).toMatch(/APP_KEY must be 32 random bytes/)
    expect(problems.join("\n")).toMatch(/CRON_SECRET/)
    expect(problems.join("\n")).toMatch(/ALLOW_LOCAL_APP_URL/)
  })
  it("never prints the database password", () => {
    expect(describeDatabase(GOOD.DIRECT_URL)).toBe("ep-x.aws.neon.tech/hrm")
    expect(describeDatabase("nonsense")).toBe("(invalid URL)")
  })
  it("takes the admin from the environment only when all three are set", () => {
    expect(adminFromEnv({})).toBeNull()
    expect(adminFromEnv({ ADMIN_USERNAME: "rehman" })).toBe("partial")
    expect(
      adminFromEnv({
        ADMIN_USERNAME: "rehman",
        ADMIN_EMAIL: "a@b.pk",
        ADMIN_PASSWORD: "x".repeat(12),
      })
    ).toEqual({ username: "rehman", email: "a@b.pk", password: "x".repeat(12) })
  })
})

describe("backup script helpers", () => {
  it("names the file with the date and time in Pakistan", () => {
    // 22:30 UTC on 10 Oct = 03:30 on 11 Oct in Karachi.
    expect(backupFileName(new Date("2026-10-10T22:30:00Z"), "dump")).toBe(
      "hrm-2026-10-11-0330.dump"
    )
    expect(backupFileName(new Date("2026-10-11T04:05:00Z"), "sql")).toBe(
      "hrm-2026-10-11-0905.sql"
    )
  })
  it("keeps libpq parameters and drops Prisma-only ones", () => {
    const url = libpqUrl(
      "postgresql://u:p@ep-x.aws.neon.tech/hrm?sslmode=require&schema=public&pgbouncer=true&connection_limit=5"
    )
    expect(url).toBe("postgresql://u:p@ep-x.aws.neon.tech/hrm?sslmode=require")
  })
})
