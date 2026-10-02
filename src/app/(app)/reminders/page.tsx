import type { Metadata } from "next"
import { HistoryIcon, SearchXIcon } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/empty-state"
import { LinkTabs } from "@/components/link-tabs"
import { Pagination } from "@/components/pagination"
import { ReminderLogTable } from "@/components/reminder-log-table"
import { ReminderQueue } from "@/components/reminder-queue/reminder-queue"
import { ReminderLogToolbar } from "@/components/reminders/reminder-log-toolbar"
import { Button } from "@/components/ui/button"
import { getReminderQueue, listReminderLog } from "@/lib/data"
import { isFiltered, parseReminderLogParams } from "@/lib/list-filters"
import { hrefWith } from "@/lib/url"

export const metadata: Metadata = { title: "Reminders" }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

// docs/06 §4.9: Queue (the dashboard's queue, in full) | Log (every reminder, filterable).
export default async function RemindersPage({ searchParams }: Props) {
  const sp = await searchParams
  const tab = sp.tab === "log" ? "log" : "queue"
  const params = parseReminderLogParams(sp)
  const [queue, log] = await Promise.all([getReminderQueue(), listReminderLog(params)])

  return (
    <div className="flex flex-col gap-6">
      <LinkTabs
        label="Reminders"
        tabs={[
          {
            href: "/reminders",
            label: "Queue",
            count: queue.queue.length,
            active: tab === "queue",
          },
          {
            href: "/reminders?tab=log",
            label: "Log",
            count: log.totalAll,
            active: tab === "log",
          },
        ]}
      />

      {tab === "queue" ? (
        <ReminderQueue
          initialItems={queue.queue}
          adminEmail={queue.adminEmail}
          adminSummaryWaLink={queue.adminSummaryWaLink}
        />
      ) : log.totalAll === 0 ? (
        <div className="rounded-lg border border-border bg-surface">
          <EmptyState
            icon={HistoryIcon}
            message="No reminders yet. They appear here once the dashboard check queues them."
          />
        </div>
      ) : (
        <>
          <ReminderLogToolbar params={params} />
          <section
            aria-label="Reminder log"
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            {log.total === 0 ? (
              <EmptyState
                icon={SearchXIcon}
                message={
                  params.q
                    ? `No reminders match “${params.q}”.`
                    : "No reminders match these filters."
                }
                action={
                  isFiltered(params) ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href="/reminders?tab=log">Clear filters</Link>
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <ReminderLogTable rows={log.rows} showDomain showClient />
                <Pagination
                  page={log.page}
                  pageSize={log.pageSize}
                  total={log.total}
                  hrefFor={(page) => hrefWith("/reminders", sp, { page })}
                />
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}
