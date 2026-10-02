"use client"

import { useState, useTransition, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import { InlineAlert } from "@/components/inline-alert"
import { Switch } from "@/components/ui/switch"
import { savePreferencesAction } from "@/lib/mock/settings-actions"
import type { PreferenceSection } from "@/lib/domain/preferences"

export function SettingsSection<T extends object>({
  title,
  description,
  section,
  initial,
  children,
  extra,
  validate,
}: {
  title: string
  description: string
  section: PreferenceSection
  initial: T
  children: (draft: T, update: (patch: Partial<T>) => void) => ReactNode
  extra?: ReactNode
  validate?: (draft: T) => string | undefined
}) {
  const [draft, setDraft] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [error, setError] = useState("")
  const [pending, start] = useTransition()
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  return (
    <section className="grid gap-5 border-b border-border py-6 first:pt-0 last:border-0 last:pb-0 xl:grid-cols-[minmax(140px,1fr)_minmax(0,2fr)] xl:gap-8">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>
      <form
        className="min-w-0 space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          const invalid = validate?.(draft)
          if (invalid) {
            setError(invalid)
            return
          }
          start(async () => {
            setError("")
            try {
              const res = await savePreferencesAction(section, draft)
              if (!res.ok) setError(res.error)
              else {
                const next =
                  section === "email"
                    ? { ...draft, password: "", passwordSaved: true }
                    : draft
                setDraft(next)
                setSaved(next)
                toast.success(`${title} saved`)
              }
            } catch {
              setError("Couldn’t save your changes. Try again.")
            }
          })
        }}
      >
        {error && <InlineAlert>{error}</InlineAlert>}
        <fieldset disabled={pending} className="min-w-0 space-y-5">
          {children(draft, (patch) => setDraft((prev) => ({ ...prev, ...patch })))}
        </fieldset>
        <div className="form-action-bar">
          {extra}
          <Button
            disabled={!dirty}
            loading={pending}
            title={!dirty ? "No unsaved changes" : undefined}
          >
            Save {title.toLowerCase()}
          </Button>
        </div>
      </form>
    </section>
  )
}

export function SettingInput({
  id,
  label,
  value,
  onChange,
  type = "text",
  help,
  required = true,
  min,
  max,
}: {
  id: string
  label: string
  value: string | number
  onChange: (value: string) => void
  type?: string
  help?: string
  required?: boolean
  min?: number
  max?: number
}) {
  return (
    <FormField id={id} label={label} help={help}>
      <Input
        id={id}
        value={value}
        type={type}
        required={required}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={help ? `${id}-help` : undefined}
      />
    </FormField>
  )
}

export function SettingToggle({
  id,
  label,
  help,
  checked,
  onChange,
}: {
  id: string
  label: string
  help: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer">
        <span className="block text-sm font-medium">{label}</span>
        <span id={`${id}-help`} className="mt-1 block text-xs text-ink-muted">
          {help}
        </span>
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        aria-describedby={`${id}-help`}
      />
    </div>
  )
}
