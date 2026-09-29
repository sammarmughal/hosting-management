import type { Metadata } from "next"

import { AuthHeading } from "@/components/auth-heading"

export const metadata: Metadata = { title: "Forgot password" }

export default function ForgotPage() {
  return (
    <>
      <AuthHeading
        title="Forgot password"
        description="We'll email a reset link to the admin address."
      />
      <p className="text-sm text-ink-muted">
        Coming in a later step: The email field and Send reset link.
      </p>
    </>
  )
}
