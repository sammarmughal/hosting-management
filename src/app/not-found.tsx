import type { Metadata } from "next"
import { ErrorState } from "@/components/error-state"
export const metadata: Metadata = { title: "Page not found" }
export default function NotFound() {
  return (
    <ErrorState
      title="Page not found"
      message="This page doesn’t exist or has been moved."
    />
  )
}
