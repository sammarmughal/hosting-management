// GET /api/health (docs/07 §3): public uptime check. Returns "ok", no data.
export function GET() {
  return new Response("ok", { headers: { "Cache-Control": "no-store" } })
}
