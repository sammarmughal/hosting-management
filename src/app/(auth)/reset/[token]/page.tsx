import type { Metadata } from "next"

import { AuthHeading } from "@/components/auth-heading"

export const metadata: Metadata = { title: "Reset password" }

export default function ResetPage() {
  return (
    <>
      <AuthHeading
        title="Reset password"
        description="Choose a new password for your account."
      />
      <p className="text-sm text-ink-muted">
        Coming in a later step: New password, confirm, and Save password.
      </p>
    </>
  )
}
