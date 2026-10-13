// npm run backup [-- --env-file .env.production] [--out backups] [--sql]   (docs/11 §6)
//
// Dumps the database in DATABASE_URL with mariadb-dump (or mysqldump) to a
// dated file: backups/hrm-YYYY-MM-DD-HHMM.sql.gz (gzipped SQL), or plain .sql
// with --sql. Restore with: gunzip -c file.sql.gz | mariadb -u USER -p DBNAME.
// Needs the MariaDB/MySQL client tools on the PATH (or MYSQL_DUMP=path), and
// network access to the database: run it over SSH on the Hostinger server
// when the host is localhost (docs/11 §6).
import { spawn } from "node:child_process"
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync,
} from "node:fs"
import path from "node:path"
import { pipeline } from "node:stream/promises"
import { createGunzip, createGzip } from "node:zlib"

import { backupFileName, dumpCommand, looksLikeDump } from "./backup-name"

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

/** Runs the dump tool, streaming its output (gzipped unless plain) into `file`. */
function runDump(
  tool: string,
  args: string[],
  password: string,
  file: string,
  plain: boolean
) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(tool, args, {
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, MYSQL_PWD: password },
    })
    child.on("error", reject)
    const out = createWriteStream(file)
    const done = plain
      ? pipeline(child.stdout, out)
      : pipeline(child.stdout, createGzip(), out)
    child.on("close", (code) => {
      done.then(() => resolve(code ?? 1), reject)
    })
  })
}

/** The first few hundred characters of the file, gunzipping when needed. */
async function fileHead(file: string, gz: boolean): Promise<string> {
  let head = ""
  const src = createReadStream(file)
  const stream = gz ? src.pipe(createGunzip()) : src
  for await (const chunk of stream) {
    head += chunk.toString()
    if (head.length >= 400) break
  }
  src.destroy()
  return head
}

async function main() {
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

  const url = process.env.DATABASE_URL
  if (!url) fail("Set DATABASE_URL (mysql://user:password@host:3306/database).")
  const { args, password, target } = dumpCommand(url)

  const plain = process.argv.includes("--sql")
  const outDir = path.resolve(arg("--out") ?? "backups")
  mkdirSync(outDir, { recursive: true })
  const file = path.join(outDir, backupFileName(new Date(), plain ? "sql" : "sql.gz"))
  const tools = process.env.MYSQL_DUMP
    ? [process.env.MYSQL_DUMP]
    : ["mariadb-dump", "mysqldump"]

  console.log(`Backing up ${target} → ${file}`)
  let status: number | null = null
  for (const tool of tools) {
    try {
      status = await runDump(tool, args, password, file, plain)
      break
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
    }
  }
  if (status === null)
    fail(
      `Couldn't run ${tools.join(" or ")}. Install the MariaDB client tools or set MYSQL_DUMP.`
    )
  if (status !== 0) {
    if (existsSync(file)) unlinkSync(file)
    fail(`The dump failed (exit ${status}); no backup was written.`)
  }

  const size = statSync(file).size
  if (size === 0 || !looksLikeDump(await fileHead(file, !plain)))
    fail(`${file} doesn't look like a database dump.`)
  console.log(
    `Backup written: ${file} (${(size / 1024).toFixed(0)} KB). Keep a copy off this machine.`
  )
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)))
