import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const EXPORTS = [
  {
    href: "/api/export/clients",
    label: "Clients",
    help: "One row per client, with contact details and currency.",
  },
  {
    href: "/api/export/companies",
    label: "Companies",
    help: "Every company with its client and billing details.",
  },
  {
    href: "/api/export/subscriptions",
    label: "Subscriptions",
    help: "Every subscription, its service, company, renewal date and charge.",
  },
  {
    href: "/api/export/payments",
    label: "Payments",
    help: "Every payment recorded, all dates.",
  },
  {
    href: "/api/export/invoices",
    label: "Invoices",
    help: "Every invoice with totals and status.",
  },
]

/** Settings → Backup: the weekly CSV export (docs/11 §6). */
export function BackupSettings() {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(140px,1fr)_minmax(0,2fr)] xl:gap-8">
      <div>
        <h2 className="text-base font-semibold">Backup</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Download your data as CSV files once a week and keep them somewhere safe, like
          Google Drive. The files open in Excel.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {EXPORTS.map((e) => (
          <li key={e.href} className="flex min-h-14 items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{e.label}</span>
              <span className="block text-xs text-ink-muted">{e.help}</span>
            </span>
            <Button asChild variant="outline" size="sm" className="max-md:h-11">
              <a
                href={e.href}
                download
                aria-label={`Download ${e.label.toLowerCase()} CSV`}
              >
                <DownloadIcon />
                CSV
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
