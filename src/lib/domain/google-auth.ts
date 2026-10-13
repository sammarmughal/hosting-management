// Sign in with Google (docs/05 §3a). Pure: the configuration read from the
// environment, and the decision on the ID token Google returned. The route
// handlers (app/api/auth/google) do the redirects and the session.

type Env = Record<string, string | undefined>

const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/

/** ADMIN_EMAILS="a@x.com, B@y.com" → ["a@x.com", "b@y.com"]: trimmed, lower case, unique. */
export function parseAllowlist(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter((e) => EMAIL_RE.test(e))
    ),
  ]
}

export interface GoogleConfig {
  clientId: string
  clientSecret: string
  allowlist: string[]
}

export interface AuthConfig {
  /** null unless GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and ADMIN_EMAILS are all set. */
  google: GoogleConfig | null
  /**
   * Email + password (+ our 2FA). PASSWORD_LOGIN_ENABLED=0 turns it off, but
   * only while Google sign-in is configured, so a missing variable can never
   * lock the owner out.
   */
  passwordLogin: boolean
}

export function authConfig(env: Env): AuthConfig {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() ?? ""
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim() ?? ""
  const allowlist = parseAllowlist(env.ADMIN_EMAILS)
  const google =
    clientId && clientSecret && allowlist.length
      ? { clientId, clientSecret, allowlist }
      : null
  const off = /^(0|false|off|no)$/i.test(env.PASSWORD_LOGIN_ENABLED?.trim() ?? "")
  return { google, passwordLogin: !(off && google) }
}

/** The ID token claims we read (https://developers.google.com/identity/openid-connect/openid-connect). */
export interface GoogleClaims {
  iss?: unknown
  aud?: unknown
  exp?: unknown
  email?: unknown
  email_verified?: unknown
}

export type GoogleDecision =
  | { ok: true; email: string }
  | {
      ok: false
      reason: "invalid_token" | "unverified" | "not_allowed"
      email: string | null
    }

const ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"])

/**
 * Whether this Google account may sign in. The token must be for our client,
 * from Google and unexpired; the email must be one Google reports as
 * verified (a boolean true, nothing else) and on the allowlist, compared
 * without regard to letter case. Gmail dots and "+tags" are NOT folded: the
 * address must match an allowlist entry exactly.
 */
export function googleLoginDecision(
  claims: GoogleClaims,
  {
    clientId,
    allowlist,
    now,
  }: { clientId: string; allowlist: readonly string[]; now: Date }
): GoogleDecision {
  const email =
    typeof claims.email === "string" ? claims.email.trim().toLowerCase() : null
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (
    !ISSUERS.has(String(claims.iss)) ||
    !aud.includes(clientId) ||
    typeof claims.exp !== "number" ||
    claims.exp * 1000 <= now.getTime() ||
    !email
  )
    return { ok: false, reason: "invalid_token", email }
  if (claims.email_verified !== true) return { ok: false, reason: "unverified", email }
  if (!allowlist.map((a) => a.toLowerCase()).includes(email))
    return { ok: false, reason: "not_allowed", email }
  return { ok: true, email }
}

/** /login?error=… → the message shown. Every refusal reads the same. */
export function loginErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case undefined:
    case "":
      return null
    case "locked":
      return "Too many attempts. Try again in 15 minutes."
    case "cancelled":
      return "Sign-in with Google was cancelled."
    case "expired":
      return "That sign-in took too long. Try again."
    default:
      return "Invalid credentials."
  }
}
