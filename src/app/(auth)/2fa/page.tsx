import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { VerifyForm } from "@/components/auth/auth-forms"
import { requirePasswordStage } from "@/lib/server/session"

export const metadata: Metadata = { title: "Two-step verification" }
export const dynamic = "force-dynamic"

export default async function Page() {
  const stage = await requirePasswordStage()
  if (!stage) redirect("/login?expired=1")
  if (!stage.admin.totpEnabled) redirect("/2fa/setup")
  return <VerifyForm />
}
