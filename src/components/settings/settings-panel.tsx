"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FormField } from "@/components/form-field"
import { PasswordInput } from "@/components/password-input"
import { SettingsSection, SettingInput } from "@/components/settings/settings-section"
import { ReminderSettingsForm } from "@/components/settings/reminder-settings"
import { TemplateSettingsForms } from "@/components/settings/template-settings"
import { SecuritySettings } from "@/components/settings/security-settings"
import { Button } from "@/components/ui/button"
import { CURRENCIES } from "@/lib/domain/validation"
import { sendTestEmailAction } from "@/lib/mock/settings-actions"
import type { Preferences } from "@/lib/domain/preferences"
import { cn } from "@/lib/utils"

const tabs = {
  business: "Business",
  reminders: "Reminders",
  email: "Email",
  templates: "Templates",
  security: "Security",
}
export type SettingsTab = keyof typeof tabs
const selectClass =
  "h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-base max-md:h-11"

export function SettingsPanel({
  initial,
  tab,
  today,
  logins,
}: {
  initial: Preferences
  tab: string
  today: string
  logins: React.ComponentProps<typeof SecuritySettings>["logins"]
}) {
  const router = useRouter()
  const active = Object.hasOwn(tabs, tab) ? (tab as SettingsTab) : "business"
  const [testing, startTesting] = useTransition()
  const [visited, setVisited] = useState<SettingsTab[]>([active])
  if (!visited.includes(active)) setVisited([...visited, active])
  return (
    <div className="grid items-start gap-6 md:grid-cols-[152px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="hidden flex-col gap-1 md:flex">
        {Object.entries(tabs).map(([key, label]) => (
          <Link
            key={key}
            href={`/settings?tab=${key}`}
            scroll={false}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium hover:bg-surface-subtle",
              active === key ? "bg-surface-subtle text-brand-700" : "text-ink-muted"
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <label className="md:hidden">
        <span className="sr-only">Settings section</span>
        <select
          className={selectClass}
          value={active}
          onChange={(e) =>
            router.push(`/settings?tab=${e.target.value}`, { scroll: false })
          }
        >
          {Object.entries(tabs).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="min-w-0 rounded-lg border border-border bg-surface p-4 sm:p-5">
        <div hidden={active !== "business"}>
          <SettingsSection
            title="Business"
            description="Your business details appear in reminder emails and WhatsApp messages."
            section="business"
            initial={initial.business}
          >
            {(draft, update) => (
              <>
                <SettingInput
                  id="business-name"
                  label="Business name"
                  value={draft.businessName}
                  onChange={(businessName) => update({ businessName })}
                />
                <SettingInput
                  id="business-phone"
                  label="Business phone"
                  type="tel"
                  value={draft.businessPhone}
                  onChange={(businessPhone) => update({ businessPhone })}
                />
                <SettingInput
                  id="admin-email"
                  label="Admin email"
                  type="email"
                  value={draft.adminEmail}
                  onChange={(adminEmail) => update({ adminEmail })}
                />
                <SettingInput
                  id="admin-whatsapp"
                  label="Admin WhatsApp"
                  type="tel"
                  value={draft.adminWhatsapp}
                  onChange={(adminWhatsapp) => update({ adminWhatsapp })}
                />
                <FormField id="default-currency" label="Default currency">
                  <select
                    id="default-currency"
                    className={selectClass}
                    value={draft.defaultCurrency}
                    onChange={(e) =>
                      update({
                        defaultCurrency: e.target.value as typeof draft.defaultCurrency,
                      })
                    }
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </FormField>
              </>
            )}
          </SettingsSection>
        </div>
        {visited.includes("reminders") && (
          <div hidden={active !== "reminders"}>
            <ReminderSettingsForm initial={initial.reminders} />
          </div>
        )}
        {visited.includes("email") && (
          <div hidden={active !== "email"}>
            <SettingsSection
              title="Email"
              description="Connect your SMTP account to send reminders from your business address."
              section="email"
              initial={initial.email}
              extra={
                <Button
                  type="button"
                  variant="outline"
                  loading={testing}
                  onClick={() =>
                    startTesting(async () => {
                      try {
                        const result = await sendTestEmailAction()
                        if (result.ok) toast.success("Test email sent to admin")
                        else toast.error(result.error)
                      } catch {
                        toast.error("Couldn’t send the test email")
                      }
                    })
                  }
                >
                  Send test email
                </Button>
              }
            >
              {(draft, update) => (
                <>
                  <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <SettingInput
                      id="smtp-host"
                      label="SMTP host"
                      value={draft.host}
                      onChange={(host) => update({ host })}
                    />
                    <SettingInput
                      id="smtp-port"
                      label="Port"
                      type="number"
                      min={1}
                      max={65535}
                      value={draft.port}
                      onChange={(v) => update({ port: Number(v) })}
                    />
                  </div>
                  <FormField id="smtp-encryption" label="Encryption">
                    <select
                      id="smtp-encryption"
                      className={selectClass}
                      value={draft.encryption}
                      onChange={(e) =>
                        update({ encryption: e.target.value as typeof draft.encryption })
                      }
                    >
                      {["SSL", "TLS", "None"].map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>
                  </FormField>
                  <SettingInput
                    id="smtp-username"
                    label="Username"
                    value={draft.username}
                    onChange={(username) => update({ username })}
                  />
                  <FormField
                    id="smtp-password"
                    label="Password"
                    help={
                      draft.passwordSaved
                        ? "Saved. Leave blank to keep the current password."
                        : "Enter the password for your SMTP account."
                    }
                  >
                    <PasswordInput
                      id="smtp-password"
                      placeholder={draft.passwordSaved ? "Saved" : ""}
                      value={draft.password}
                      autoComplete="new-password"
                      onChange={(e) => update({ password: e.target.value })}
                    />
                  </FormField>
                  <SettingInput
                    id="from-email"
                    label="From email"
                    type="email"
                    value={draft.fromEmail}
                    onChange={(fromEmail) => update({ fromEmail })}
                  />
                  <SettingInput
                    id="from-name"
                    label="From name"
                    value={draft.fromName}
                    onChange={(fromName) => update({ fromName })}
                  />
                </>
              )}
            </SettingsSection>
          </div>
        )}
        {visited.includes("templates") && (
          <div hidden={active !== "templates"}>
            <TemplateSettingsForms
              initial={initial.templates}
              business={initial.business}
              today={today}
            />
          </div>
        )}
        {visited.includes("security") && (
          <div hidden={active !== "security"}>
            <SecuritySettings logins={logins} />
          </div>
        )}
      </div>
    </div>
  )
}
