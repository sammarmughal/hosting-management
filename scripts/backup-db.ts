// npm run backup [-- --env-file .env.production] [--out backups] [--sql]   (docs/11 §6)
//
// pg_dump of the database in DIRECT_URL (Neon's direct, non-pooled URL) to a
// dated file: backups/hrm-YYYY-MM-DD-HHMM.dump (custom format, compressed;
// restore with pg_restore) or .sql with --sql. Needs pg_dump on the PATH (or
// PG_DUMP=path), the same major version as the server or newer.
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  closeSync,
  statSync,
  unlinkSync,
} from "node:fs"
import path from "node:path"

import { backupFileName, libpqUrl } from "./backup-name"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

const envFile = arg("--env-file")
if (envFile) {
  if (!existsSync(envFile)) fail(`Env file not found: ${envFile}`)
  process.loadEnvFile(envFile)
} else {
  try {
    process.loadEnvFile(".env")
  } catch {
    // Environment only.
  }
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) fail("Set DIRECT_URL (Neon → Connect → direct connection string).")

const sql = process.argv.includes("--sql")
const outDir = path.resolve(arg("--out") ?? "backups")
mkdirSync(outDir, { recursive: true })
const file = path.join(outDir, backupFileName(new Date(), sql ? "sql" : "dump"))
const pgDump = process.env.PG_DUMP || "pg_dump"

const target = new URL(libpqUrl(url))
console.log(`Backing up ${target.hostname}${target.pathname} → ${file}`)
const result = spawnSync(
  pgDump,
  [
    `--dbname=${target.toString()}`,
    `--file=${file}`,
    `--format=${sql ? "plain" : "custom"}`,
    "--no-owner",
    "--no-privileges",
  ],
  { stdio: ["ignore", "inherit", "inherit"] }
)
if (result.error)
  fail(
    `Couldn't run ${pgDump}: ${result.error.message}. Install the PostgreSQL client tools or set PG_DUMP.`
  )
if (result.status !== 0) {
  if (existsSync(file)) unlinkSync(file)
  fail(`pg_dump failed (exit ${result.status}); no backup was written.`)
}

// A custom-format dump starts with "PGDMP"; anything empty is a failed backup.
const size = statSync(file).size
if (!sql) {
  const fd = openSync(file, "r")
  const head = Buffer.alloc(5)
  readSync(fd, head, 0, 5, 0)
  closeSync(fd)
  if (head.toString() !== "PGDMP") fail(`${file} doesn't look like a pg_dump file.`)
}
if (size === 0) fail(`${file} is empty.`)
console.log(
  `Backup written: ${file} (${(size / 1024).toFixed(0)} KB). Keep a copy off this machine.`
)
