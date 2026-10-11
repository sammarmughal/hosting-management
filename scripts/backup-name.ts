// Pure helpers for scripts/backup-db.ts.

/** "hrm-2026-10-11-0930.dump", in Pakistan time so the date matches the owner's day. */
export function backupFileName(now: Date, ext: "dump" | "sql"): string {
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

/** Query parameters libpq (pg_dump) understands; Prisma-only ones are dropped. */
const LIBPQ_PARAMS = new Set([
  "sslmode",
  "sslrootcert",
  "sslcert",
  "sslkey",
  "channel_binding",
  "connect_timeout",
  "application_name",
  "options",
  "target_session_attrs",
])

/** A Prisma connection string → one pg_dump accepts (e.g. drops schema=, pgbouncer=). */
export function libpqUrl(url: string): string {
  const u = new URL(url)
  for (const key of [...u.searchParams.keys()])
    if (!LIBPQ_PARAMS.has(key)) u.searchParams.delete(key)
  return u.toString()
}
