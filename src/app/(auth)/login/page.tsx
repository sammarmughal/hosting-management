import type { Metadata } from "next"

import { AuthHeading } from "@/components/auth-heading"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <>
      <AuthHeading title="Sign in" description="Use your admin username or email." />
      <p className="text-sm text-ink-muted">
        Coming in a later step: Username or email, password and Sign in.
      </p>
    </>
  )
}
