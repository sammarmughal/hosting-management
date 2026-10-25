import { requireAdmin } from "@/lib/server/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** The old services export moved to /api/export/subscriptions (docs/14 §9). */
export async function GET(request: Request) {
  await requireAdmin()
  return Response.redirect(new URL("/api/export/subscriptions", request.url), 308)
}
