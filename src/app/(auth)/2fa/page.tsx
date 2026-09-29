import type { Metadata } from "next"

import { AuthHeading } from "@/components/auth-heading"

export const metadata: Metadata = { title: "Two-step verification" }

export default function TwoFactorPage() {
  return (
    <>
      <AuthHeading
        title="Two-step verification"
        description="Enter the 6-digit code from your authenticator app."
      />
      <p className="text-sm text-ink-muted">
        Coming in a later step: Six digit boxes, Verify, and the recovery code option.
      </p>
    </>
  )
}
