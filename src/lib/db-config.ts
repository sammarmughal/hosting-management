// Pool settings for @prisma/adapter-mariadb, shared by the app (db.ts), the
// scripts, the seed and the tests. Not "server-only": the scripts import it.
import type { PoolConfig } from "mariadb"

// Hostinger shared hosting caps connections per database user. Five leaves
// room for a migration or backup session next to the running app.
export const CONNECTION_LIMIT = 5

const MYSQL_URL = /^(mysql|mariadb):\/\//

/** Parses `mysql://user:pass@host:port/db` into the adapter's pool config. */
export function mariadbConfig(url: string | undefined): PoolConfig {
  if (!url) throw new Error("DATABASE_URL is not set")
  if (!MYSQL_URL.test(url)) {
    throw new Error("DATABASE_URL must be a mysql:// connection string")
  }
  const u = new URL(url)
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""))
  if (!database) throw new Error("DATABASE_URL has no database name")
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
    connectionLimit: CONNECTION_LIMIT,
    connectTimeout: 5_000,
    acquireTimeout: 10_000,
    // The adapter reads and writes DATETIME values as UTC; this keeps the
    // server's own defaults (CURRENT_TIMESTAMP) in UTC too, whatever the
    // server clock's zone is.
    initSql: "SET time_zone = '+00:00'",
  }
}
