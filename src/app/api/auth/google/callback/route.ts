// GET /api/auth/google/callback: Google redirects here after sign-in
// (docs/05 §3a). Public by design: the state cookie (compared in constant
// time) and the PKCE verifier tie it to the browser that started the flow,
// and completeGoogleLogin applies the allowlist, the throttle and the log.
import { timingSafeEqual } from "node:crypto"

import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

import { authConfig } from "@/lib/domain/google-auth"
import { deviceLabel } from "@/lib/domain/user-agent"
import { audit } from "@/lib/server/audit"
import { prisma } from "@/lib/server/db"
import {
  completeGoogleLogin,
  FLOW_COOKIE_PATH,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/server/google-login"
import { clientIp, startSession, userAgent } from "@/lib/server/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const appUrl = (path: string) =>
  `${(process.env.APP_URL ?? "").replace(/\/+$/, "")}${path}`

function sameState(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

export async function GET(request: NextRequest) {
  const jar = await cookies()
  const storedState = jar.get(STATE_COOKIE)?.value
  const codeVerifier = jar.get(VERIFIER_COOKIE)?.value
  // One use only.
  for (const name of [STATE_COOKIE, VERIFIER_COOKIE])
    jar.set(name, "", { path: FLOW_COOKIE_PATH, maxAge: 0 })

  const back = (error: string) =>
    NextResponse.redirect(appUrl(`/login?error=${error}`), 303)
  const cfg = authConfig(process.env).google
  if (!cfg) return back("invalid")

  const params = request.nextUrl.searchParams
  const googleError = params.get("error")
  if (googleError) return back(googleError === "access_denied" ? "cancelled" : "invalid")
  const state = params.get("state")
  const code = params.get("code")
  if (!state || !code || !storedState || !codeVerifier || !sameState(state, storedState))
    return back("expired")

  const ip = await clientIp()
  const result = await completeGoogleLogin({ cfg, code, codeVerifier, ip })
  if (!result.ok) return back(result.error)

  // Google sign-in skips our 2FA (docs/05 §3a): straight to a full session.
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  const session = await startSession(result.adminId, "full")
  await prisma.admin.update({
    where: { id: result.adminId },
    data: { lastLoginAt: new Date(), lastLoginIp: ip },
  })
  await audit("login.success", {
    ip,
    details: {
      device: deviceLabel(await userAgent()),
      session: session.id.slice(0, 16),
      method: "google",
      googleEmail: result.email,
    },
  })

  // The session cookie is SameSite=Strict, and this request came from
  // Google, so a redirect would still count as cross-site and the cookie
  // wouldn't be sent. A same-site page that moves on does it.
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/dashboard"><title>Signing in…</title></head><body><p>Signing you in… <a href="/dashboard">Continue</a></p></body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        // The callback URL holds the one-time code; don't pass it on.
        "Referrer-Policy": "no-referrer",
      },
    }
  )
}
