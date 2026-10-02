import type { Metadata } from "next"
import { ErrorState } from "@/components/error-state"
export const metadata: Metadata = { title: "Session expired" }
export default function Page() {
  return (
    <ErrorState title="Session expired" message="Sign in again to continue working." href="/login" label="Sign in again" />
  )
}
