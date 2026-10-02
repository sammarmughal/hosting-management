import type { Metadata } from "next"
import { PasswordResetForm } from "@/components/auth/auth-forms"
export const metadata: Metadata = { title: "Reset password" }
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <PasswordResetForm token={token} />
}
