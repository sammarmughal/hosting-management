"use client"
import { ErrorState } from "@/components/error-state"
export default function ErrorPage() {
  return (
    <ErrorState
      title="Couldn’t load this page"
      message="Something went wrong. Please try again later."
    />
  )
}
