import type { Metadata } from "next"
import { ErrorState } from "@/components/error-state"
export const metadata: Metadata = { title: "Access denied" }
export default function Page() {
  return (
    <ErrorState
      title="Access denied"
      message="You don’t have permission to open this page."
    />
  )
}
