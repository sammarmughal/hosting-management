"use client"

import { useState } from "react"
import { XIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import {
  SettingsSection,
  SettingInput,
  SettingToggle,
} from "@/components/settings/settings-section"
import { reminderSettingsSchema, type ReminderSettings } from "@/lib/domain/preferences"
import { stageLabel, parseStages } from "@/lib/domain/stages"

export function StageEditor({
  stages,
  onChange,
}: {
  stages: number[]
  onChange: (stages: number[]) => void
}) {
  const [value, setValue] = useState("")
  const [error, setError] = useState("")
  function add() {
    const n = Number(value)
    if (!value.trim() || !Number.isInteger(n) || n < -60 || n > 90) {
      setError("Enter a whole number from −60 to 90.")
      return
    }
    if (stages.includes(n)) {
      setError("This stage is already included.")
      return
    }
    onChange(parseStages([...stages, n]))
    setValue("")
    setError("")
  }
  return (
    <FormField
      id="stage"
      label="Reminder stages"
      help="Days before expiry. 0 is expiry day; negative values are after expiry."
      error={error}
    >
      <div className="flex flex-wrap gap-2">
        {stages.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle pl-3 font-mono text-sm"
            title={stageLabel(s)}
          >
            {s}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              title={`Remove ${stageLabel(s)}`}
              aria-label={`Remove ${stageLabel(s)}`}
              onClick={() => onChange(stages.filter((v) => v !== s))}
            >
              <XIcon className="size-3" />
            </Button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          id="stage"
          type="number"
          min={-60}
          max={90}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add()
            }
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "stage-error" : "stage-help"}
          className="max-w-28"
          placeholder="Days"
        />
        <Button type="button" variant="outline" onClick={add}>
          <PlusIcon />
          Add stage
        </Button>
      </div>
    </FormField>
  )
}

export function ReminderSettingsForm({ initial }: { initial: ReminderSettings }) {
  return (
    <SettingsSection
      title="Reminders"
      description="Choose when renewals need attention and how reminders are sent."
      section="reminders"
      initial={initial}
      validate={(draft) => {
        const r = reminderSettingsSchema.safeParse(draft)
        return r.success ? undefined : r.error.issues[0]?.message
      }}
    >
      {(draft, update) => (
        <>
          <div className="grid grid-cols-2 gap-4">
            <SettingInput
              id="orange"
              label="Orange limit (days)"
              type="number"
              min={1}
              max={90}
              value={draft.orange}
              onChange={(v) => update({ orange: Number(v) })}
            />
            <SettingInput
              id="red"
              label="Red limit (days)"
              type="number"
              min={0}
              max={89}
              value={draft.red}
              onChange={(v) => update({ red: Number(v) })}
            />
          </div>
          <div aria-label="Live status colour preview">
            <div className="grid grid-cols-4 overflow-hidden rounded-md text-center text-xs">
              <span className="bg-green-bg py-3 text-green-fg">Active</span>
              <span className="bg-orange-bg py-3 text-orange-fg">Expiring</span>
              <span className="bg-red-bg py-3 text-red-fg">Urgent</span>
              <span className="bg-expired-bg py-3 text-expired-fg">Expired</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs text-ink-muted">
              <span>&gt; {draft.orange} days</span>
              <span>
                {draft.red + 1}–{draft.orange} days
              </span>
              <span>0–{draft.red} days</span>
              <span>&lt; 0 days</span>
            </div>
          </div>
          <StageEditor stages={draft.stages} onChange={(stages) => update({ stages })} />
          <SettingToggle
            id="post-expiry"
            label="Send post-expiry reminders"
            help="Continue reminding clients after their service expires."
            checked={draft.postExpiry}
            onChange={(postExpiry) => update({ postExpiry })}
          />
          <SettingToggle
            id="auto-send"
            label="Auto-send emails when checking"
            help="Send queued emails when a reminder check runs."
            checked={draft.autoSend}
            onChange={(autoSend) => update({ autoSend })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingInput
              id="interval"
              label="Check interval (minutes)"
              type="number"
              min={5}
              max={1440}
              value={draft.interval}
              onChange={(v) => update({ interval: Number(v) })}
            />
            <SettingInput
              id="batch"
              label="Email batch size"
              type="number"
              min={1}
              max={100}
              value={draft.batchSize}
              onChange={(v) => update({ batchSize: Number(v) })}
            />
          </div>
        </>
      )}
    </SettingsSection>
  )
}
