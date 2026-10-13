import { createHash, timingSafeEqual } from "node:crypto"

import { runCheck } from "@/lib/server/reminders"

// The daily scheduled check: an hPanel cron job calls it with curl (docs/11 §4).
// The same idempotent runCheck() as the dashboard and "Check now": it takes
// the app_locks 'check' row lock, and the unique keys stop duplicate reminders, invoices
// and notifications, so overlapping or repeated runs add nothing.
//
// POST (the documented curl command) and GET both need
// `Authorization: Bearer <CRON_SECRET>`. Without CRON_SECRET configured the
// route answers 503 and does nothing.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Constant-time compare (hashing first makes the lengths equal). */
function authorised(header: string | null, secret: string) {
  const digest = (s: string) => createHash("sha256").update(s).digest()
  return timingSafeEqual(digest(header ?? ""), digest(`Bearer ${secret}`))
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 32)
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 })
  if (!authorised(request.headers.get("authorization"), secret))
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  // Forced: the daily run always checks, whatever the dashboard did earlier.
  const result = await runCheck({ force: true })
  return Response.json(result, { headers: { "Cache-Control": "no-store" } })
}

export const GET = handle
export const POST = handle
