"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FormField } from "@/components/form-field"
import { PasswordInput } from "@/components/password-input"
import { InlineAlert } from "@/components/inline-alert"
import { RecoveryCodes } from "@/components/auth/recovery-codes"
import { EmptyState } from "@/components/empty-state"
import { HistoryIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { securityAction } from "@/lib/mock/settings-actions"
import { formatDateTimePK } from "@/lib/domain/relative-time"

type Kind = "recovery" | "reset" | "sessions"
const labels: Record<Kind, string> = {
  recovery: "Regenerate recovery codes",
  reset: "Reset two-step verification",
  sessions: "Log out all sessions",
}
export function SecuritySettings({
  logins,
}: {
  logins: { at: string; device: string; address: string; current: boolean }[]
}) {
  const router = useRouter()
  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
    code: "",
  })
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const [kind, setKind] = useState<Kind | null>(null)
  const [confirmPassword, setConfirmPassword] = useState("")
  const [confirmCode, setConfirmCode] = useState("")
  const [dialogError, setDialogError] = useState("")
  const [codes, setCodes] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [working, startWorking] = useTransition()
  function open(k: Kind) {
    setKind(k)
    setDialogError("")
    setConfirmPassword("")
    setConfirmCode("")
    setCodes([])
    setSaved(false)
  }
  return (
    <div className="space-y-6">
      <section className="grid gap-5 border-b border-border pb-6 xl:grid-cols-[1fr_2fr] xl:gap-8">
        <div>
          <h2 className="text-base font-semibold">Change password</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Confirm your current password and authenticator code.
          </p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              setError("")
              try {
                const res = await securityAction("password", passwords)
                if (!res.ok) setError(res.error)
                else {
                  setPasswords({ current: "", next: "", confirm: "", code: "" })
                  toast.success("Password changed")
                }
              } catch {
                setError("Couldn’t change your password. Try again.")
              }
            })
          }}
        >
          {error && <InlineAlert>{error}</InlineAlert>}
          {(
            [
              ["current", "Current password"],
              ["next", "New password"],
              ["confirm", "Confirm new password"],
            ] as const
          ).map(([key, label]) => (
            <FormField
              key={key}
              id={`security-${key}`}
              label={label}
              help={key === "next" ? "Use at least 12 characters." : undefined}
            >
              <PasswordInput
                id={`security-${key}`}
                value={passwords[key]}
                onChange={(e) => setPasswords({ ...passwords, [key]: e.target.value })}
                autoComplete={key === "current" ? "current-password" : "new-password"}
                required
                minLength={key === "current" ? undefined : 12}
              />
            </FormField>
          ))}
          <FormField id="security-code" label="Authenticator code">
            <Input
              id="security-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={passwords.code}
              required
              onChange={(e) =>
                setPasswords({ ...passwords, code: e.target.value.replace(/\D/g, "") })
              }
            />
          </FormField>
          <div className="form-action-bar justify-end">
            <Button disabled={!Object.values(passwords).some(Boolean)} loading={pending}>
              Save password
            </Button>
          </div>
        </form>
      </section>
      <section className="grid gap-5 border-b border-border pb-6 xl:grid-cols-[1fr_2fr] xl:gap-8">
        <div>
          <h2 className="text-base font-semibold">Account access</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Manage recovery codes, verification and signed-in devices.
          </p>
        </div>
        <div className="space-y-5">
          {(["recovery", "reset", "sessions"] as const).map((k) => (
            <div key={k}>
              <Button variant="outline" onClick={() => open(k)}>
                {labels[k]}
              </Button>
              <p className="mt-2 text-xs text-ink-muted">
                {k === "recovery"
                  ? "Replaces your previous recovery codes."
                  : k === "reset"
                    ? "You’ll need to set up your authenticator again."
                    : "Signs you out on every device, including this one."}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-base font-semibold">Recent logins</h2>
        <div className="overflow-hidden rounded-lg border border-border">
          {logins.length === 0 ? (
            <EmptyState icon={HistoryIcon} message="No recent logins to show." />
          ) : (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[36%]">Date</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead className="hidden xl:table-cell">IP address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logins.map((l) => (
                  <TableRow key={l.at}>
                    <TableCell className="max-md:whitespace-normal">
                      <span className="block">{formatDateTimePK(l.at).split(",")[0]}</span>
                      <span className="block text-xs text-ink-muted">{formatDateTimePK(l.at).split(",")[1]?.trim()}</span>
                    </TableCell>
                    <TableCell className="max-md:whitespace-normal">
                      {l.device}
                      {l.current && (
                        <span className="ml-2 text-xs text-ink-muted">This session</span>
                      )}
                      <span className="mt-1 block font-mono text-xs text-ink-muted xl:hidden">
                        {l.address}
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-sm text-ink-muted xl:table-cell">
                      {l.address}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
      <Dialog
        open={kind !== null}
        onOpenChange={(open) => {
          if (!open && !working && (!codes.length || saved)) setKind(null)
        }}
      >
        <DialogContent showCloseButton={!codes.length || saved}>
          <DialogHeader>
            <DialogTitle>
              {codes.length ? "Save your recovery codes" : kind ? labels[kind] : ""}
            </DialogTitle>
            <DialogDescription>
              {codes.length
                ? "Store these somewhere safe before continuing."
                : kind === "sessions"
                  ? "You’ll be signed out on every device."
                  : "Confirm your password to continue."}
            </DialogDescription>
          </DialogHeader>
          {codes.length ? (
            <div className="space-y-4">
              <RecoveryCodes codes={codes} />
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
                I have saved these codes
              </label>
              <Button className="w-full" disabled={!saved} onClick={() => setKind(null)}>
                Continue
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (!kind) return
                startWorking(async () => {
                  setDialogError("")
                  try {
                    const res = await securityAction(kind, {
                      current: confirmPassword,
                      code: confirmCode,
                    })
                    if (!res.ok) setDialogError(res.error)
                    else if (kind === "recovery") setCodes(res.data?.codes ?? [])
                    else {
                      setKind(null)
                      router.push(kind === "reset" ? "/2fa/setup" : "/login")
                    }
                  } catch {
                    setDialogError("Couldn’t complete this action. Try again.")
                  }
                })
              }}
            >
              {dialogError && <InlineAlert>{dialogError}</InlineAlert>}
              {kind !== "sessions" && (
                <FormField id="confirm-current" label="Current password">
                  <PasswordInput
                    id="confirm-current"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </FormField>
              )}
              {kind === "reset" && (
                <FormField id="confirm-code" label="Authenticator code">
                  <Input
                    id="confirm-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    required
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value)}
                  />
                </FormField>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={working}
                  onClick={() => setKind(null)}
                >
                  Cancel
                </Button>
                <Button loading={working}>{kind ? labels[kind] : "Continue"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
