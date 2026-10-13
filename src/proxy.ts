import { NextResponse, type NextRequest } from "next/server"

// docs/02 §4 and docs/05 §7. A convenience redirect when there is no session
// cookie at all, plus a per-request CSP nonce. NOT the security boundary:
// requireAdmin() in the (app) layout and every action/route handler is.

const PUBLIC = [
  /^\/login$/,
  /^\/2fa(\/.*)?$/,
  /^\/forgot$/,
  /^\/reset\/[^/]+$/,
  /^\/api\/health$/,
  // Sign in with Google: the start redirect and Google's callback (state + PKCE checked there).
  /^\/api\/auth\/google(\/callback)?$/,
  // Bearer-token protected, see the route (no cookie from a scheduler).
  /^\/api\/cron\/check$/,
  /^\/(403|419|500)$/,
  // Public invoice links (docs/13 §8): the token is the access check.
  /^\/i\/[^/]+(\/pdf)?$/,
]

function csp(nonce: string) {
  const dev = process.env.NODE_ENV === "development"
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Next and Tailwind inject styles; scripts stay nonce-locked (docs/05 §7).
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ")
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const cookie = process.env.SESSION_COOKIE_NAME || "hrm_session"
  if (!PUBLIC.some((re) => re.test(pathname)) && !request.cookies.has(cookie)) {
    if (pathname.startsWith("/api/")) return new NextResponse(null, { status: 401 })
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const policy = csp(nonce)
  const headers = new Headers(request.headers)
  headers.set("x-nonce", nonce)
  headers.set("Content-Security-Policy", policy)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set("Content-Security-Policy", policy)
  return response
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}
