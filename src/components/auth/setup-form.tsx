"use client"

import { useState, useTransition } from "react"
import { CopyIcon } from "lucide-react"
import { AuthHeading } from "@/components/auth-heading"
import { InlineAlert } from "@/components/inline-alert"
import { StepIndicator } from "@/components/step-indicator"
import { OtpInput } from "@/components/auth/otp-input"
import { RecoveryCodes, copyText } from "@/components/auth/recovery-codes"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { finishSetupAction, setupCodeAction } from "@/actions/auth"

/** The QR image and key come from the server (the pending secret never reaches a cookie). */
export function SetupForm({ qrSrc, manualKey }: { qrSrc: string; manualKey: string }) {
  const [step, setStep] = useState(0)
  const [code, setCode] = useState("")
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
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
          <div className="mx-auto flex size-50 items-center justify-center rounded-md border border-border bg-white p-2">
            {/* Generated on our server; no external QR service (docs/05 §3). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrSrc} alt="QR code for your authenticator app" className="size-full" />
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
          {error && <InlineAlert>{error}</InlineAlert>}
          <RecoveryCodes codes={codes} />
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />I
            have saved these codes
          </label>
          <Button
            className="w-full"
            disabled={!saved}
            loading={pending}
            onClick={() =>
              start(async () => {
                setError("")
                try {
                  // Promotes the session and redirects to the dashboard.
                  const res = await finishSetupAction()
                  if (res && !res.ok) setError(res.error)
                } catch {
                  setError("Couldn’t finish setup. Try again.")
                }
              })
            }
          >
            Continue
          </Button>
        </div>
      )}
    </>
  )
}
