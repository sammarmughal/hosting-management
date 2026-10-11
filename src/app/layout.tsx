import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

export const metadata: Metadata = {
  title: { default: "Renewals", template: "%s · Renewals" },
  description: "Hosting renewal manager",
  robots: { index: false, follow: false },
}

// The CSP nonce (src/proxy.ts) only reaches pages rendered per request, so
// nothing is prerendered at build time (docs/05 §7).
export const dynamic = "force-dynamic"

export const viewport: Viewport = {
  themeColor: "#f7f8fa",
  viewportFit: "cover",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  )
}
