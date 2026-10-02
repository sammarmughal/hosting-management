import type { Metadata } from "next"
import { ErrorState } from "@/components/error-state"
export const metadata: Metadata = { title: "Couldn’t load this page" }
export default function Page() {
  return (
    <ErrorState
      title="Couldn’t load this page"
      message="Something went wrong. Please try again later."
    />
  )
}
