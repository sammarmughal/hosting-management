import type { Metadata } from "next"
import { SetupForm } from "@/components/auth/setup-form"
export const metadata: Metadata = { title: "Set up two-step verification" }
export default function Page() {
  return <SetupForm />
}
