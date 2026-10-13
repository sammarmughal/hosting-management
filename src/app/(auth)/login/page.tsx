import type { Metadata } from "next"
import { LoginForm } from "@/components/auth/auth-forms"
import { authConfig, loginErrorMessage } from "@/lib/domain/google-auth"
export const metadata: Metadata = { title: "Sign in" }
export const dynamic = "force-dynamic"
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const { error } = await searchParams
  const auth = authConfig(process.env)
  return (
    <LoginForm
      google={auth.google !== null}
      passwordLogin={auth.passwordLogin}
      initialError={
        loginErrorMessage(typeof error === "string" ? error : undefined) ?? ""
      }
    />
  )
}
