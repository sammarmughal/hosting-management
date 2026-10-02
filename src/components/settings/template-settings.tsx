"use client"

import { useRef, useState } from "react"
import { FormField } from "@/components/form-field"
import { SettingsSection } from "@/components/settings/settings-section"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/domain/default-templates"
import { renderForDays, daysText } from "@/lib/domain/templates"
import { addDays, formatDatePK } from "@/lib/domain/dates"
import type {
  TemplateSettings,
  BusinessSettings,
  Preferences,
} from "@/lib/domain/preferences"

const names: Record<TemplateKey, string> = {
  client_email: "Client email",
  client_whatsapp: "Client WhatsApp",
  admin_email: "Admin email",
  admin_whatsapp: "Admin WhatsApp",
}

export function TemplateSettingsForms({
  initial,
  business,
  today,
}: {
  initial: Preferences["templates"]
  business: BusinessSettings
  today: string
}) {
  return (
    <>
      {(Object.keys(names) as TemplateKey[]).map((key) => (
        <SettingsSection
          key={key}
          title={names[key]}
          description={
            key.startsWith("client")
              ? "The reminder sent to a client about their hosting service."
              : "The renewal summary sent to your admin address or number."
          }
          section={key}
          initial={initial[key]}
        >
          {(draft, update) => (
            <TemplateFields
              templateKey={key}
              draft={draft}
              update={update}
              business={business}
              today={today}
            />
          )}
        </SettingsSection>
      ))}
    </>
  )
}

function TemplateFields({
  templateKey,
  draft,
  update,
  business,
  today,
}: {
  templateKey: TemplateKey
  draft: TemplateSettings
  update: (patch: Partial<TemplateSettings>) => void
  business: BusinessSettings
  today: string
}) {
  const email = templateKey.endsWith("email")
  const subject = useRef<HTMLTextAreaElement>(null)
  const body = useRef<HTMLTextAreaElement>(null)
  const active = useRef<"subject" | "body">("body")
  const [days, setDays] = useState(7)
  const vars = {
    client_name: "Ayesha Siddiqui",
    company: "Ayesha Couture",
    domain: "ayeshacouture.pk",
    renewal_date: formatDatePK(addDays(today, days)),
    days_left: Math.abs(days),
    days_text: daysText(days),
    amount: "6,500",
    currency: "PKR",
    business_name: business.businessName,
    business_phone: business.businessPhone,
    today: formatDatePK(today),
    count: "1",
    summary_list: "ayeshacouture.pk · Ayesha Siddiqui · PKR 6,500",
    summary_table: "<p>ayeshacouture.pk · Ayesha Siddiqui · PKR 6,500</p>",
  }
  const placeholders = templateKey.startsWith("client")
    ? [
        "client_name",
        "domain",
        "renewal_date",
        "days_text",
        "amount",
        "currency",
        "business_name",
        "business_phone",
      ]
    : ["today", "count", email ? "summary_table" : "summary_list"]
  function insert(key: string) {
    const field = active.current
    const el = field === "subject" ? subject.current : body.current
    const start = el?.selectionStart ?? draft[field].length
    const end = el?.selectionEnd ?? start
    const token = `{${key}}`
    update({ [field]: draft[field].slice(0, start) + token + draft[field].slice(end) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }
  const rendered = renderForDays(draft.body, days, vars, {
    mode: email ? "html" : "text",
  })
  return (
    <>
      {email && (
        <FormField id={`${templateKey}-subject`} label="Subject">
          <Textarea
            ref={subject}
            id={`${templateKey}-subject`}
            value={draft.subject}
            onFocus={() => {
              active.current = "subject"
            }}
            onChange={(e) => update({ subject: e.target.value })}
            className="min-h-20 font-mono text-sm"
          />
        </FormField>
      )}
      <FormField
        id={`${templateKey}-body`}
        label="Body"
        help="Use [[before]], [[today]] and [[after]] to vary the message by renewal status."
      >
        <Textarea
          ref={body}
          id={`${templateKey}-body`}
          value={draft.body}
          onFocus={() => {
            active.current = "body"
          }}
          onChange={(e) => update({ body: e.target.value })}
          required
          className="field-sizing-fixed h-56 min-h-56 resize-y font-mono text-sm"
        />
      </FormField>
      <div>
        <p className="mb-2 text-xs text-ink-muted">Insert a placeholder at the cursor</p>
        <div className="flex flex-wrap gap-2">
          {placeholders.map((key) => (
            <Button
              type="button"
              key={key}
              variant="outline"
              size="xs"
              className="font-mono"
              onClick={() => insert(key)}
            >{`{${key}}`}</Button>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-border bg-surface-subtle p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">Live preview</span>
          <select
            aria-label={`${names[templateKey]} preview timing`}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="h-9 max-w-full rounded-md border border-border bg-surface px-2 text-sm max-md:h-11"
          >
            <option value={7}>7 days before</option>
            <option value={0}>Expiry day</option>
            <option value={-3}>3 days after</option>
          </select>
        </div>
        {email && (
          <p className="mb-3 text-sm font-medium break-words">
            {renderForDays(draft.subject, days, vars, { mode: "text" })}
          </p>
        )}
        {email ? (
          <iframe
            title={`${names[templateKey]} message preview`}
            sandbox=""
            className="h-64 w-full rounded-md border border-border bg-white"
            srcDoc={`<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>body{font:13px/1.6 system-ui;color:#111827;padding:8px;overflow-wrap:anywhere}p{margin:0 0 12px}</style></head><body>${rendered}</body></html>`}
          />
        ) : (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap text-ink-muted">
            {rendered}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          update({
            subject: DEFAULT_TEMPLATES[templateKey].subject ?? "",
            body: DEFAULT_TEMPLATES[templateKey].body,
          })
        }
      >
        Reset to default
      </Button>
    </>
  )
}
