import Link from "next/link"

import { TimerPill } from "@/components/timer-pill"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatPhone } from "@/lib/domain/whatsapp"
import type { ClientListRow } from "@/types/view"

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`
const contact = (c: ClientListRow) => c.email ?? (c.phone ? formatPhone(c.phone) : null)

/** /clients: one row per client (docs/14 §7). Table from 700px of container width, cards below. */
export function ClientsTable({ rows }: { rows: ClientListRow[] }) {
  return (
    <div className="@container">
      <div className="hidden @min-[700px]:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">Client</TableHead>
              <TableHead className="w-28 text-right">Companies</TableHead>
              <TableHead className="w-32 text-right">Subscriptions</TableHead>
              <TableHead className="w-20">Currency</TableHead>
              <TableHead className="w-48 pl-6">Next renewal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <Link
                    href={`/clients/${c.id}`}
                    title={c.name}
                    className="block truncate font-medium text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    {c.name}
                  </Link>
                  <div className="truncate text-xs text-ink-muted">{contact(c)}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.companies}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {c.activeSubscriptions}
                </TableCell>
                <TableCell className="font-mono text-ink-muted">{c.currency}</TableCell>
                <TableCell className="pl-6">
                  {c.next ? (
                    <TimerPill renewalDate={c.next.renewalDate} />
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border @min-[700px]:hidden">
        {rows.map((c) => (
          <li key={c.id} className="px-4 py-4">
            <Link
              href={`/clients/${c.id}`}
              className="block truncate text-base font-medium text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              {c.name}
            </Link>
            {contact(c) && (
              <p className="truncate text-sm text-ink-muted">{contact(c)}</p>
            )}
            <p className="mt-1 text-sm text-ink-muted">
              {plural(c.companies, "company", "companies")} ·{" "}
              {plural(c.activeSubscriptions, "active subscription")}
            </p>
            {c.next && (
              <div className="mt-3">
                <TimerPill renewalDate={c.next.renewalDate} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
