import type { Metadata } from "next"
import { VerifyForm } from "@/components/auth/auth-forms"
export const metadata: Metadata = { title: "Two-step verification" }
export default function Page() {
  return <VerifyForm />
}
