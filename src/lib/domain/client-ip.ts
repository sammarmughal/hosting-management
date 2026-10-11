// Which request header holds the visitor's IP (docs/05 §4). Login throttling,
// the audit log and the /i/* rate limit use it. Only trust a header that your
// host's proxy sets itself; see docs/11 "Verify the client IP" after deploy.
// Pure: the caller passes the header reader and the configured name in.

export const DEFAULT_IP_HEADER = "x-forwarded-for"

/** TRUSTED_IP_HEADER, lower-cased; the default when unset or not a header name. */
export function trustedIpHeader(configured: string | undefined): string {
  const name = configured?.trim().toLowerCase()
  return name && /^[a-z0-9-]+$/.test(name) ? name : DEFAULT_IP_HEADER
}

/** The first value of the trusted header (a proxy chain lists the client first). */
export function pickClientIp(
  get: (name: string) => string | null | undefined,
  configured: string | undefined
): string {
  const value = get(trustedIpHeader(configured))
  const first = value?.split(",")[0]?.trim()
  return (first || "unknown").slice(0, 45)
}
