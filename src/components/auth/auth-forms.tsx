"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AuthHeading } from "@/components/auth-heading"
import { FormField } from "@/components/form-field"
import { InlineAlert } from "@/components/inline-alert"
import { PasswordInput } from "@/components/password-input"
import { OtpInput } from "@/components/auth/otp-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  loginAction,
  verifyCodeAction,
  requestResetAction,
  resetPasswordAction,
} from "@/lib/mock/auth-actions"

const linkClass =
  "inline-flex min-h-11 items-center justify-center text-sm text-brand-700 hover:underline"

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  return (
    <>
      <AuthHeading
        title="Sign in to Renewals"
        description="Use your admin username or email."
      />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          start(async () => {
            setError("")
            try {
              const res = await loginAction(
                String(data.get("identifier")),
                String(data.get("password"))
              )
              if (!res.ok) setError(res.error)
              else router.push("/2fa")
            } catch {
              setError("Couldn’t sign in. Try again.")
            }
          })
        }}
      >
        {error && <InlineAlert>{error}</InlineAlert>}
        <FormField id="identifier" label="Username or email">
          <Input
            id="identifier"
            name="identifier"
            autoComplete="username"
            required
            autoCapitalize="none"
          />
        </FormField>
        <FormField id="password" label="Password">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </FormField>
        <Button className="w-full" loading={pending}>
          Sign in
        </Button>
      </form>
      <div className="mt-3 text-center">
        <Link className={linkClass} href="/forgot">
          Forgot password?
        </Link>
      </div>
    </>
  )
}

export function VerifyForm() {
  const router = useRouter()
  const [recovery, setRecovery] = useState(false)
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  return (
    <>
      <AuthHeading
        title="Two-step verification"
        description={
          recovery
            ? "Enter one of your saved recovery codes."
            : "Enter the 6-digit code from your authenticator app."
        }
      />
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          start(async () => {
            try {
              const res = await verifyCodeAction(code.trim().toUpperCase(), recovery)
              if (!res.ok) setError(res.error)
              else router.push("/dashboard")
            } catch {
              setError("Couldn’t verify the code. Try again.")
            }
          })
        }}
      >
        {error && <InlineAlert>{error}</InlineAlert>}
        {recovery ? (
          <FormField id="recovery" label="Recovery code">
            <Input
              id="recovery"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              className="font-mono"
              required
            />
          </FormField>
        ) : (
          <OtpInput value={code} onChange={setCode} invalid={!!error} />
        )}
        <Button
          className="w-full"
          loading={pending}
          disabled={recovery ? !code.trim() : !/^\d{6}$/.test(code)}
        >
          Verify
        </Button>
      </form>
      <button
        className={`${linkClass} mt-3 w-full`}
        onClick={() => {
          setRecovery(!recovery)
          setCode("")
          setError("")
        }}
      >
        {recovery ? "Use an authenticator code instead" : "Use a recovery code instead"}
      </button>
    </>
  )
}

export function PasswordResetForm({ token }: { token?: string }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  return (
    <>
      <AuthHeading
        title={token ? "Reset password" : "Forgot password"}
        description={
          token
            ? "Choose a new password for your account."
            : "Enter the email address for your account."
        }
      />
      {done ? (
        <div role="status" className="space-y-4">
          <p className="text-sm text-ink-muted">
            {token
              ? "Your password has been reset. You can now sign in."
              : "If an account matches that address, you’ll receive a password reset link."}
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            start(async () => {
              setError("")
              try {
                const res = token
                  ? await resetPasswordAction(
                      token,
                      String(data.get("password")),
                      String(data.get("confirm"))
                    )
                  : await requestResetAction(String(data.get("email")))
                if (!res.ok) setError(res.error)
                else setDone(true)
              } catch {
                setError("Couldn’t save your request. Try again.")
              }
            })
          }}
        >
          {error && <InlineAlert>{error}</InlineAlert>}
          {token ? (
            <>
              <FormField
                id="new-password"
                label="New password"
                help="Use at least 12 characters."
              >
                <PasswordInput
                  id="new-password"
                  name="password"
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
              </FormField>
              <FormField id="confirm-password" label="Confirm password">
                <PasswordInput
                  id="confirm-password"
                  name="confirm"
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
              </FormField>
            </>
          ) : (
            <FormField id="email" label="Email">
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </FormField>
          )}
          <Button className="w-full" loading={pending}>
            {token ? "Save password" : "Send reset link"}
          </Button>
          <div className="text-center">
            <Link
              className={linkClass}
              href={token && token === "expired" ? "/forgot" : "/login"}
            >
              {token === "expired" ? "Request a new link" : "Back to sign in"}
            </Link>
          </div>
        </form>
      )}
    </>
  )
}
