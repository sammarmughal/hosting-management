import type { NextConfig } from "next"

// docs/05 §7. The CSP (with a per-request nonce) is set in src/proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
]

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ["@node-rs/argon2", "@react-pdf/renderer"],
  // The invoice PDF reads its TTF fonts at runtime (docs/13 §7); ship them
  // with the standalone build for every route that can render a PDF
  // (downloads, the public link, and emails sent from Server Actions).
  outputFileTracingIncludes: {
    "/**": ["./src/assets/fonts/**", "./node_modules/pdfkit/js/standard-fonts/**"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
