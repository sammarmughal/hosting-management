import type { Metadata } from "next"
import { PasswordResetForm } from "@/components/auth/auth-forms"
export const metadata: Metadata = { title: "Forgot password" }
export default function Page() {
  return <PasswordResetForm />
}
