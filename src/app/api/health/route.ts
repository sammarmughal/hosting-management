import { prisma } from "@/lib/server/db"

// GET /api/health (docs/07 §3, docs/11 §7): public uptime check, no login.
// 200 {"status":"ok","db":"ok"} when the database answers, else 503
// {"status":"error","db":"unreachable"}. Never returns data, versions,
// error messages or anything from the environment.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DB_TIMEOUT_MS = 3000

async function databaseReachable(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS)
    })
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout])
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function GET() {
  const ok = await databaseReachable()
  return Response.json(
    ok ? { status: "ok", db: "ok" } : { status: "error", db: "unreachable" },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  )
}
