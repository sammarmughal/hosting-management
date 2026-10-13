// Pure helpers for scripts/backup-db.ts.

/** "hrm-2026-10-11-0930.sql.gz", in Pakistan time so the date matches the owner's day. */
export function backupFileName(now: Date, ext: "sql.gz" | "sql"): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  )
  return `hrm-${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}.${ext}`
}

export interface DumpCommand {
  /** Arguments for mariadb-dump / mysqldump. Never contains the password. */
  args: string[]
  /** Passed through the MYSQL_PWD environment variable, never the command line. */
  password: string
  /** "localhost/u123456789_hrm", safe to print. */
  target: string
}

/** A mysql:// DATABASE_URL → the dump command for it. */
export function dumpCommand(url: string): DumpCommand {
  const u = new URL(url)
  if (u.protocol !== "mysql:" && u.protocol !== "mariadb:")
    throw new Error("DATABASE_URL must be a mysql:// connection string")
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""))
  if (!database) throw new Error("DATABASE_URL has no database name")
  return {
    args: [
      `--host=${u.hostname}`,
      `--port=${u.port || "3306"}`,
      `--user=${decodeURIComponent(u.username)}`,
      // A consistent snapshot of the InnoDB tables without locking the app out.
      "--single-transaction",
      // Shared hosting users lack the PROCESS privilege tablespaces need.
      "--no-tablespaces",
      "--routines",
      "--default-character-set=utf8mb4",
      database,
    ],
    password: decodeURIComponent(u.password),
    target: `${u.hostname}/${database}`,
  }
}

/**
 * The start of a real dump: the "-- MariaDB dump" / "-- MySQL dump" header
 * within its first lines (MariaDB 11 puts a sandbox-mode line before it).
 */
export const looksLikeDump = (head: string) =>
  head
    .split("\n")
    .slice(0, 3)
    .some((line) => /^-- (MariaDB|MySQL) dump/.test(line))
