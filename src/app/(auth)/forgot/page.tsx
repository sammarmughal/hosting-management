import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { PasswordResetForm } from "@/components/auth/auth-forms"
import { authConfig } from "@/lib/domain/google-auth"

export const metadata: Metadata = { title: "Forgot password" }
export const dynamic = "force-dynamic"

export default function Page() {
  // No password sign-in (Google only): nothing to reset.
  if (!authConfig(process.env).passwordLogin) redirect("/login")
  return <PasswordResetForm />
}
