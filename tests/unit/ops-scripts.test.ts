// The pure parts of scripts/setup-production.ts and scripts/backup-db.ts.
import { describe, expect, it } from "vitest"

import { mariadbConfig } from "@/lib/db-config"

import { backupFileName, dumpCommand, looksLikeDump } from "../../scripts/backup-name"
import {
  adminFromEnv,
  describeDatabase,
  productionEnvProblems,
} from "../../scripts/setup-checks"

const GOOD = {
  DATABASE_URL: "mysql://u123456789_hrm:s%40cret@localhost:3306/u123456789_hrm",
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
      DATABASE_URL: "postgresql://u:p@ep-x.neon.tech/hrm",
      APP_KEY: "short",
      APP_URL: "http://localhost:3000",
      CRON_SECRET: "abc",
      ALLOW_LOCAL_APP_URL: "1",
    })
    expect(problems).toHaveLength(5)
    expect(problems.join("\n")).toMatch(/DATABASE_URL must be a mysql/)
    expect(problems.join("\n")).toMatch(/APP_KEY must be 32 random bytes/)
    expect(problems.join("\n")).toMatch(/CRON_SECRET/)
    expect(problems.join("\n")).toMatch(/ALLOW_LOCAL_APP_URL/)
    expect(productionEnvProblems({ ...GOOD, DATABASE_URL: "" })[0]).toMatch(
      /DATABASE_URL is not set/
    )
  })
  it("never prints the database password", () => {
    expect(describeDatabase(GOOD.DATABASE_URL)).toBe("localhost/u123456789_hrm")
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
    expect(backupFileName(new Date("2026-10-10T22:30:00Z"), "sql.gz")).toBe(
      "hrm-2026-10-11-0330.sql.gz"
    )
    expect(backupFileName(new Date("2026-10-11T04:05:00Z"), "sql")).toBe(
      "hrm-2026-10-11-0905.sql"
    )
  })
  it("builds the dump command without the password on the command line", () => {
    const cmd = dumpCommand(GOOD.DATABASE_URL)
    expect(cmd.password).toBe("s@cret")
    expect(cmd.target).toBe("localhost/u123456789_hrm")
    expect(cmd.args).toContain("--single-transaction")
    expect(cmd.args).toContain("--no-tablespaces")
    expect(cmd.args).toContain("--user=u123456789_hrm")
    expect(cmd.args.at(-1)).toBe("u123456789_hrm")
    expect(cmd.args.join(" ")).not.toMatch(/s@cret|s%40cret/)
    expect(() => dumpCommand("postgresql://u:p@h/db")).toThrow(/mysql:\/\//)
  })
  it("recognises a real dump by its header", () => {
    // MariaDB 11's dump starts with a sandbox-mode line, then the header.
    expect(
      looksLikeDump(
        "/*M!999999\\- enable the sandbox mode */ \n-- MariaDB dump 10.20-11.8.9-MariaDB, for Win64 (AMD64)\n--\n"
      )
    ).toBe(true)
    expect(looksLikeDump("-- MariaDB dump 10.19  Distrib 11.8.2-MariaDB")).toBe(true)
    expect(looksLikeDump("-- MySQL dump 10.13  Distrib 8.0.40")).toBe(true)
    expect(looksLikeDump("mysqldump: Got error: 1045")).toBe(false)
  })
})

describe("database pool config", () => {
  it("caps the pool at 5 connections and pins the session to UTC", () => {
    const cfg = mariadbConfig(GOOD.DATABASE_URL)
    expect(cfg).toMatchObject({
      host: "localhost",
      port: 3306,
      user: "u123456789_hrm",
      password: "s@cret",
      database: "u123456789_hrm",
      connectionLimit: 5,
      initSql: "SET time_zone = '+00:00'",
    })
  })
  it("rejects anything that isn't a MySQL URL", () => {
    expect(() => mariadbConfig(undefined)).toThrow(/not set/)
    expect(() => mariadbConfig("postgresql://u:p@h/db")).toThrow(/mysql:\/\//)
    expect(() => mariadbConfig("mysql://u:p@localhost:3306/")).toThrow(/no database/)
  })
})
