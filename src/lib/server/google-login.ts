import "server-only"

import { decodeIdToken, Google } from "arctic"

import {
  googleLoginDecision,
  type GoogleClaims,
  type GoogleConfig,
} from "@/lib/domain/google-auth"
import { audit } from "@/lib/server/audit"
import { prisma } from "@/lib/server/db"
import { alertOnUnusualActivity } from "@/lib/server/login-alert"
import { failureDelay, isLocked, recordAttempt } from "@/lib/server/throttle"

// Sign in with Google (docs/05 §3a): the OAuth 2.0 authorization code flow
// with PKCE and a state cookie (arctic), then an allowlist check on the ID
// token. An allowlisted account signs in as the single admin and skips our
// own 2FA: Google's 2-Step Verification protects that account instead.

export const CALLBACK_PATH = "/api/auth/google/callback"
/** Short-lived, Lax (the callback is a cross-site redirect from Google), path-scoped. */
export const STATE_COOKIE = "hrm_google_state"
export const VERIFIER_COOKIE = "hrm_google_verifier"
export const FLOW_COOKIE_PATH = "/api/auth/google"
export const FLOW_TTL_SECONDS = 10 * 60

/** https://renewals.abdulrehmaan.net/api/auth/google/callback (from APP_URL). */
export const googleRedirectUri = () =>
  `${(process.env.APP_URL ?? "").replace(/\/+$/, "")}${CALLBACK_PATH}`

export const googleClient = (cfg: GoogleConfig) =>
  new Google(cfg.clientId, cfg.clientSecret, googleRedirectUri())

/** Code → ID token claims, straight from Google's token endpoint over TLS. */
export type CodeExchange = (code: string, codeVerifier: string) => Promise<GoogleClaims>

export const exchangeWithGoogle =
  (cfg: GoogleConfig): CodeExchange =>
  async (code, codeVerifier) => {
    const tokens = await googleClient(cfg).validateAuthorizationCode(code, codeVerifier)
    // Not signature-checked: the token comes directly from Google's token
    // endpoint over TLS in exchange for our client secret (OpenID Connect
    // Core §3.1.3.7). Issuer, audience and expiry are still checked.
    return decodeIdToken(tokens.idToken()) as GoogleClaims
  }

export type GoogleLoginResult =
  | { ok: true; adminId: number; email: string }
  | { ok: false; error: "invalid" | "locked" }

/**
 * After the state check: exchanges the code, applies the allowlist and the
 * throttle, and logs the outcome. The caller starts the session on ok.
 */
export async function completeGoogleLogin(input: {
  cfg: GoogleConfig
  code: string
  codeVerifier: string
  ip: string
  exchange?: CodeExchange
  now?: Date
}): Promise<GoogleLoginResult> {
  const { cfg, ip, now = new Date() } = input
  const reject = async (reason: string, email: string | null) => {
    await recordAttempt(ip, email ?? "google", "google", false)
    await audit("login.google_rejected", { ip, details: { email, reason } })
    await alertOnUnusualActivity()
    await failureDelay()
    return { ok: false as const, error: "invalid" as const }
  }

  let claims: GoogleClaims
  try {
    claims = await (input.exchange ?? exchangeWithGoogle(cfg))(
      input.code,
      input.codeVerifier
    )
  } catch (err) {
    console.error(
      "google sign-in: code exchange failed",
      err instanceof Error ? err.message : err
    )
    return reject("exchange_failed", null)
  }

  const decision = googleLoginDecision(claims, {
    clientId: cfg.clientId,
    allowlist: cfg.allowlist,
    now,
  })
  // Throttled per IP and per email, like the password step.
  if (await isLocked(ip, decision.email ?? "google", now)) {
    await audit("login.locked", {
      ip,
      details: { identifier: decision.email, method: "google" },
    })
    await failureDelay()
    return { ok: false, error: "locked" }
  }
  if (!decision.ok) return reject(decision.reason, decision.email)

  const admin = await prisma.admin.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  })
  if (!admin) return reject("no_admin", decision.email)
  await recordAttempt(ip, decision.email, "google", true)
  return { ok: true, adminId: admin.id, email: decision.email }
}
