// GET /api/auth/google: starts Sign in with Google (docs/05 §3a). Public by
// design (it's how an admin signs in); it only sets the short-lived state and
// PKCE cookies and redirects to Google.
import { generateCodeVerifier, generateState } from "arctic"
import { NextResponse } from "next/server"

import { authConfig } from "@/lib/domain/google-auth"
import {
  FLOW_COOKIE_PATH,
  FLOW_TTL_SECONDS,
  googleClient,
  STATE_COOKIE,
  VERIFIER_COOKIE,
} from "@/lib/server/google-login"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const appUrl = (path: string) =>
  `${(process.env.APP_URL ?? "").replace(/\/+$/, "")}${path}`

export async function GET() {
  const cfg = authConfig(process.env).google
  if (!cfg) return NextResponse.redirect(appUrl("/login"), 303)

  const state = generateState()
  const codeVerifier = generateCodeVerifier()
  const url = googleClient(cfg).createAuthorizationURL(state, codeVerifier, [
    "openid",
    "email",
  ])
  // Always show the account chooser, so the right Google account is picked.
  url.searchParams.set("prompt", "select_account")

  const res = NextResponse.redirect(url, 303)
  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax, not Strict: Google's redirect back to the callback is cross-site.
    sameSite: "lax" as const,
    path: FLOW_COOKIE_PATH,
    maxAge: FLOW_TTL_SECONDS,
  }
  res.cookies.set(STATE_COOKIE, state, cookie)
  res.cookies.set(VERIFIER_COOKIE, codeVerifier, cookie)
  res.headers.set("Cache-Control", "no-store")
  return res
}
