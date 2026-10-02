"use client"

import * as React from "react"

import { DateRangeFilter } from "@/components/filters/date-range-filter"
import { FilterSelect } from "@/components/filters/filter-select"
import { SearchField } from "@/components/filters/search-field"
import { useUrlParams } from "@/components/filters/use-url-params"
import { REMINDER_STATUS_LABEL } from "@/components/reminder-status-badge"
import { REMINDER_STATUSES, type ReminderLogParams } from "@/lib/list-filters"

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "whatsapp", label: "WhatsApp" },
]
const STATUSES = REMINDER_STATUSES.map((s) => ({
  value: s,
  label: REMINDER_STATUS_LABEL[s],
}))

/** Search, channel, status and date range for the reminder log; all in the URL. */
export function ReminderLogToolbar({ params }: { params: ReminderLogParams }) {
  const { update, pending } = useUrlParams()
  const onSearch = React.useCallback((q: string) => update({ q }), [update])

  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
      <SearchField
        value={params.q}
        onSearch={onSearch}
        pending={pending}
        label="Search reminders"
        placeholder="Search domain or client…"
        className="flex-1 xl:max-w-xs"
      />
      <div className="flex gap-2">
        <FilterSelect
          label="Channel"
          value={params.channel}
          onChange={(channel) => update({ channel })}
          anyLabel="All"
          options={CHANNELS}
          className="flex-1 xl:w-40 xl:flex-none"
        />
        <FilterSelect
          label="Status"
          value={params.status}
          onChange={(status) => update({ status })}
          anyLabel="All"
          options={STATUSES}
          className="flex-1 xl:w-36 xl:flex-none"
        />
      </div>
      <DateRangeFilter
        from={params.from}
        to={params.to}
        onChange={(range) => update(range)}
        className="xl:ml-auto"
      />
    </div>
  )
}
