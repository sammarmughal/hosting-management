import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { SetupForm } from "@/components/auth/setup-form"
import { decrypt, encrypt } from "@/lib/server/crypto"
import { groupKey, newTotpSecret, qrSvg, totpUri } from "@/lib/server/auth"
import { prisma } from "@/lib/server/db"
import { requirePasswordStage } from "@/lib/server/session"

export const metadata: Metadata = { title: "Set up two-step verification" }
export const dynamic = "force-dynamic"

// docs/07 §1: creates the pending secret (kept in the session row, encrypted,
// never in a cookie) and renders the QR code locally (docs/05 §3).
export default async function Page() {
  const stage = await requirePasswordStage()
  if (!stage) redirect("/login?expired=1")
  if (stage.admin.totpEnabled) redirect("/2fa")

  let secretEnc = stage.session.pendingTotpSecretEnc
  if (!secretEnc) {
    secretEnc = encrypt(newTotpSecret())
    await prisma.session.update({
      where: { id: stage.session.id },
      data: { pendingTotpSecretEnc: secretEnc },
    })
  }
  const secret = decrypt(secretEnc)
  const svg = await qrSvg(totpUri(secret, stage.admin.email))
  return (
    <SetupForm
      qrSrc={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
      manualKey={groupKey(secret)}
    />
  )
}
