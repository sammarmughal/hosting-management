import { parseLogoDataUrl } from "@/lib/domain/brand"
import { requireAdmin } from "@/lib/server/session"
import { getAppSettings } from "@/lib/server/settings"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/brand/logo?v=<hash>: the uploaded logo for the sidebar mark, so
 * the (up to 200 KB) data URL isn't sent with every page. Versioned URL, so
 * the browser may keep it. 404 when there's no logo.
 */
export async function GET() {
  await requireAdmin()
  const logo = parseLogoDataUrl((await getAppSettings()).invoices.logo)
  if (!logo) return new Response(null, { status: 404 })
  return new Response(Buffer.from(logo.base64, "base64"), {
    headers: {
      "Content-Type": logo.type,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
