// APP_URL is baked into every invoice link sent to clients (/i/<token>) and
// into password-reset emails, so production must have the real public HTTPS
// URL (docs/11 §2). Pure: the caller passes the value in.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0"])

/** Why this APP_URL can't be used in production, or null when it's fine. */
export function appUrlProblem(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return "APP_URL is not set"
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return `APP_URL is not a valid URL: ${raw}`
  }
  if (url.protocol !== "https:") return `APP_URL must use https: ${raw}`
  const host = url.hostname.toLowerCase()
  if (LOCAL_HOSTS.has(host) || host.endsWith(".localhost"))
    return `APP_URL points to this machine: ${raw}`
  if (url.pathname !== "/" || url.search || url.hash)
    return `APP_URL must be just the origin, like https://renewals.ourdomain.com: ${raw}`
  return null
}
