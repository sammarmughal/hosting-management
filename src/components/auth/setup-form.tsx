"use client"

import { useState, useTransition } from "react"
import { CopyIcon, QrCodeIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { AuthHeading } from "@/components/auth-heading"
import { InlineAlert } from "@/components/inline-alert"
import { StepIndicator } from "@/components/step-indicator"
import { OtpInput } from "@/components/auth/otp-input"
import { RecoveryCodes, copyText } from "@/components/auth/recovery-codes"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { setupCodeAction } from "@/lib/mock/auth-actions"

const manualKey = "JBSW Y3DP EHPK 3PXP"
export function SetupForm() {
  const [step, setStep] = useState(0)
  const [code, setCode] = useState("")
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const router = useRouter()
  return (
    <>
      <StepIndicator steps={["Scan", "Verify", "Save"]} current={step} />
      <AuthHeading
        title={step === 2 ? "Save your recovery codes" : "Set up two-step verification"}
        description={
          step === 0
            ? "Add Renewals to your authenticator app."
            : step === 1
              ? "Enter the code from your authenticator app."
              : "Store these somewhere safe. Each code can be used once."
        }
      />
      {step === 0 ? (
        <div className="space-y-5">
          <div
            className="mx-auto flex size-50 flex-col items-center justify-center gap-3 rounded-md border border-border bg-surface-subtle"
            role="img"
            aria-label="QR code placeholder"
          >
            <QrCodeIcon className="size-24 text-ink-muted" />
            <span className="text-xs text-ink-muted">QR code preview</span>
          </div>
          <div>
            <p className="mb-2 text-sm text-ink-muted">Can’t scan? Enter this key:</p>
            <div className="flex items-center justify-between gap-2 rounded-md border border-border pl-3">
              <code className="text-xs">{manualKey}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void copyText(manualKey.replaceAll(" ", ""))}
                title="Copy manual key"
                aria-label="Copy manual key"
              >
                <CopyIcon />
              </Button>
            </div>
          </div>
          <Button className="w-full" onClick={() => setStep(1)}>
            Continue
          </Button>
        </div>
      ) : step === 1 ? (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              try {
                const res = await setupCodeAction(code)
                if (!res.ok) setError(res.error)
                else {
                  setCodes(res.data?.codes ?? [])
                  setStep(2)
                }
              } catch {
                setError("Couldn’t verify the code. Try again.")
              }
            })
          }}
        >
          {error && <InlineAlert>{error}</InlineAlert>}
          <OtpInput value={code} onChange={setCode} invalid={!!error} />
          <Button className="w-full" disabled={!/^\d{6}$/.test(code)} loading={pending}>
            Confirm code
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setStep(0)}
          >
            Back
          </Button>
        </form>
      ) : (
        <div className="space-y-5">
          <RecoveryCodes codes={codes} />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />I
            have saved these codes
          </label>
          <Button
            className="w-full"
            disabled={!saved}
            onClick={() => router.push("/dashboard")}
          >
            Continue
          </Button>
        </div>
      )}
    </>
  )
}
