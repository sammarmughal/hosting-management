// npm run check:clean-install   (CI-style check, a minute or two)
//
// A fresh checkout must install without DATABASE_URL: copies the files git
// tracks (no .env, no node_modules) to a temporary folder, runs `npm ci`
// there with DATABASE_URL and the test URLs removed from the environment,
// and checks that the Prisma client was generated. Then checks that commands
// needing the database still stop clearly without it. Exits non-zero on any
// failure; the temporary folder is removed unless --keep is given.
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const keep = process.argv.includes("--keep")
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hrm-clean-install-"))

const env = { ...process.env }
for (const k of ["DATABASE_URL", "TEST_DATABASE_URL", "E2E_DATABASE_URL"]) delete env[k]

let failed = false
function check(ok, message) {
  console.log(`${ok ? "ok  " : "FAIL"}  ${message}`)
  if (!ok) failed = true
}
function run(command, args) {
  // npm/npx are .cmd files on Windows, so they need a shell there.
  const r = spawnSync(command, args, {
    cwd: dir,
    env,
    encoding: "utf8",
    shell: process.platform === "win32",
  })
  return { status: r.status, output: `${r.stdout ?? ""}\n${r.stderr ?? ""}` }
}

try {
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
  for (const f of files) {
    fs.mkdirSync(path.join(dir, path.dirname(f)), { recursive: true })
    fs.copyFileSync(path.join(root, f), path.join(dir, f))
  }
  check(
    !fs.existsSync(path.join(dir, ".env")),
    `fresh copy of ${files.length} tracked files, no .env (${dir})`
  )

  const ci = run("npm", ["ci", "--no-audit", "--no-fund"])
  check(ci.status === 0, "npm ci succeeds without DATABASE_URL")
  if (ci.status !== 0) console.log(ci.output.slice(-2000))
  check(
    fs.existsSync(path.join(dir, "src", "generated", "prisma", "client.ts")),
    "postinstall generated the Prisma client"
  )

  const migrate = run("npx", ["prisma", "migrate", "status"])
  check(
    migrate.status !== 0 && /datasource\.url property is required/.test(migrate.output),
    "prisma migrate status stops clearly without DATABASE_URL"
  )
} finally {
  if (keep) console.log(`kept ${dir}`)
  else fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 })
}
process.exit(failed ? 1 : 0)
