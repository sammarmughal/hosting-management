import type { Metadata } from "next"
import Link from "next/link"

import { CheckNow } from "@/components/dashboard/check-now"
import { ReminderQueue } from "@/components/reminder-queue/reminder-queue"
import { ServicesTable } from "@/components/services-table"
import { MoneyValue, StatCard } from "@/components/stat-card"
import { formatAmount } from "@/lib/domain/money"
import { formatRelative } from "@/lib/domain/relative-time"
import { getDashboard, getSettings } from "@/lib/data"
import { runCheck } from "@/lib/server/reminders"
import { requireAdmin } from "@/lib/server/session"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Dashboard" }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

// docs/06 §4.4. No cron (CLAUDE.md rule 1): opening the dashboard runs the
// reminder check, throttled by check_interval_minutes, then loads the data.
export default async function DashboardPage() {
  await requireAdmin()
  await runCheck({ force: false })
  const [data, settings] = await Promise.all([getDashboard(), getSettings()])
  const { stats, queue, dueSoon } = data
  const t = settings.thresholds

  // One line per currency, default first (never summed across currencies).
  const expected = stats.expected30.length
    ? stats.expected30
    : [{ currency: settings.defaultCurrency, total: "0" }]
  const expiresToday = dueSoon.filter((s) => s.daysLeft === 0).length
  const oldestExpired = Math.min(0, ...dueSoon.map((s) => s.daysLeft))

  const needAttention = queue.length

  return (
    <div className="flex flex-col gap-6">
      {/* Header row: the topbar already shows the "Dashboard" H1 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base text-ink-muted">
          {needAttention > 0 ? (
            <>
              <span className="font-medium text-ink">
                {plural(needAttention, "renewal")}
              </span>{" "}
              {needAttention === 1 ? "needs" : "need"} attention
            </>
          ) : (
            "Nothing needs attention right now"
          )}
        </p>
        <CheckNow
          initialLastCheckAt={data.lastCheckAt}
          initialLabel={formatRelative(data.lastCheckAt, new Date())}
        />
      </div>

      {/* Stat cards: 2 columns on mobile, 3 + 2 on tablet, 5 on wide screens */}
      <section
        aria-label="Summary"
        className="grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4 xl:grid-cols-5"
      >
        <StatCard
          label="Active services"
          value={stats.active}
          dot="green"
          href="/clients?filter=active"
          className={cn(SPAN_3)}
        />
        <StatCard
          label={`Expiring in ${t.orange} days`}
          value={stats.expiring30}
          dot="orange"
          href="/clients?filter=soon"
          className={cn(SPAN_3)}
        />
        <StatCard
          label={`Urgent (${t.red} days or less)`}
          value={stats.urgent7}
          sub={
            expiresToday
              ? `${expiresToday} ${expiresToday === 1 ? "expires" : "expire"} today`
              : undefined
          }
          dot="red"
          href="/clients?filter=red"
          className={cn(SPAN_3)}
        />
        <StatCard
          label="Expired"
          value={stats.expired}
          sub={
            oldestExpired < 0 ? `Oldest ${plural(-oldestExpired, "day")} ago` : undefined
          }
          dot="expired"
          href="/clients?filter=expired"
          className={cn(SPAN_2)}
        />
        <StatCard
          label="Expected in 30 days"
          value={
            <span className="flex flex-col">
              {expected.map((e) => (
                <span key={e.currency} className="truncate">
                  <MoneyValue currency={e.currency} amount={formatAmount(e.total)} />
                </span>
              ))}
            </span>
          }
          href="/clients?filter=soon"
          className={cn(SPAN_2, "col-span-2")}
        />
      </section>

      <ReminderQueue
        // Remount with fresh rows after "Check now" refreshes the page.
        key={data.lastCheckAt}
        initialItems={queue}
        adminEmail={data.adminEmail}
        adminSummaryWaLink={data.adminSummaryWaLink}
      />

      <section
        aria-labelledby="due-soon-title"
        className="overflow-hidden rounded-lg border border-border bg-surface"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="due-soon-title" className="text-base font-semibold">
              Due soon
            </h2>
            <p className="text-sm text-ink-muted">30 days or less, and expired</p>
          </div>
          <Link
            href="/clients?filter=due"
            className="shrink-0 rounded-sm text-sm font-medium text-brand-700 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            View all
          </Link>
        </div>
        {dueSoon.length ? (
          <ServicesTable rows={dueSoon} />
        ) : (
          <p className="px-5 py-8 text-sm text-ink-muted">
            Nothing due in the next 30 days.
          </p>
        )}
      </section>
    </div>
  )
}

// Tablet: 3 cards on the first row, 2 on the second (6-column grid).
const SPAN_3 = "md:col-span-2 xl:col-span-1"
const SPAN_2 = "md:col-span-3 xl:col-span-1"
