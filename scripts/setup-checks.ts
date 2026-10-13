// Pure checks for `npm run setup:prod` (docs/11 §2): what must be set before
// a production database is touched. Takes the environment as an argument.
import { appUrlProblem } from "@/lib/domain/app-url"

type Env = Record<string, string | undefined>

const MYSQL_URL = /^(mysql|mariadb):\/\//

/** Every problem with the production environment, in the order to fix them. */
export function productionEnvProblems(env: Env): string[] {
  const problems: string[] = []
  const db = env.DATABASE_URL?.trim()
  if (!db) problems.push("DATABASE_URL is not set (hPanel → Databases → MySQL Databases).")
  else if (!MYSQL_URL.test(db))
    problems.push("DATABASE_URL must be a mysql:// connection string.")
  const appKey = env.APP_KEY?.trim()
  if (!appKey) problems.push("APP_KEY is not set (openssl rand -base64 32).")
  else if (Buffer.from(appKey.replace(/^base64:/, ""), "base64").length !== 32)
    problems.push(
      "APP_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)."
    )
  const appUrl = appUrlProblem(env.APP_URL)
  if (appUrl) problems.push(appUrl)
  if ((env.CRON_SECRET?.trim().length ?? 0) < 32)
    problems.push("CRON_SECRET must be 32+ random characters (openssl rand -hex 32).")
  if (env.ALLOW_LOCAL_APP_URL === "1")
    problems.push("ALLOW_LOCAL_APP_URL must not be set for production.")
  return problems
}

/** Host and database name only, never the password: "localhost/u123456789_hrm". */
export function describeDatabase(url: string | undefined): string {
  try {
    const u = new URL(url ?? "")
    return `${u.hostname}${u.pathname}`
  } catch {
    return "(invalid URL)"
  }
}

export interface EnvAdmin {
  username: string
  email: string
  password: string
}

/** ADMIN_USERNAME + ADMIN_EMAIL + ADMIN_PASSWORD, all or nothing. */
export function adminFromEnv(env: Env): EnvAdmin | null | "partial" {
  const username = env.ADMIN_USERNAME?.trim()
  const email = env.ADMIN_EMAIL?.trim()
  const password = env.ADMIN_PASSWORD
  const given = [username, email, password].filter(Boolean).length
  if (given === 0) return null
  if (given < 3 || !username || !email || !password) return "partial"
  return { username, email, password }
}
