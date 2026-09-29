import type { Metadata } from "next"

import { AuthHeading } from "@/components/auth-heading"

export const metadata: Metadata = { title: "Set up two-step verification" }

export default function TwoFactorSetupPage() {
  return (
    <>
      <AuthHeading
        title="Set up two-step verification"
        description="Scan the QR code with your authenticator app."
      />
      <p className="text-sm text-ink-muted">
        Coming in a later step: The QR code, the confirm step and the recovery codes.
      </p>
    </>
  )
}
