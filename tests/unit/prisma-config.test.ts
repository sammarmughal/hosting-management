// prisma.config.ts without DATABASE_URL (a fresh checkout, or a host that sets
// it only at runtime): `prisma generate`, which npm ci's postinstall runs,
// must work, and commands that connect must stop with a clear error. Run from
// an empty folder, so no .env is picked up. The full `npm ci` version of this
// check is `npm run check:clean-install`.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterAll, describe, expect, it } from "vitest"

const PRISMA = path.resolve("node_modules/prisma/build/index.js")
const CONFIG = path.resolve("prisma.config.ts")
const empty = fs.mkdtempSync(path.join(os.tmpdir(), "hrm-noenv-"))

function prisma(...args: string[]) {
  const env = { ...process.env }
  delete env.DATABASE_URL
  const r = spawnSync(process.execPath, [PRISMA, ...args, "--config", CONFIG], {
    cwd: empty,
    env,
    encoding: "utf8",
  })
  return { status: r.status, output: `${r.stdout}\n${r.stderr}` }
}

describe("prisma.config.ts without DATABASE_URL", () => {
  afterAll(() => {
    // Windows can hold the folder briefly after the child exits; an empty
    // temp folder left behind is harmless.
    try {
      fs.rmSync(empty, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch {
      /* ignore */
    }
  })

  it("loads, so `prisma generate` (npm ci's postinstall) can run", () => {
    const r = prisma("validate")
    expect(r.output).not.toMatch(
      /PrismaConfigEnvError|Cannot resolve environment variable/
    )
    expect(r.status).toBe(0)
  }, 60_000)

  it("still refuses to migrate, with a clear message", () => {
    const r = prisma("migrate", "status")
    expect(r.status).not.toBe(0)
    expect(r.output).toMatch(/datasource\.url property is required/)
  }, 60_000)
})
