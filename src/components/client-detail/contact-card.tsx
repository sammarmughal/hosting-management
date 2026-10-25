import {
  BanknoteIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  PhoneIcon,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { currencyName } from "@/lib/domain/currency"
import { buildWaLink, formatPhone } from "@/lib/domain/whatsapp"
import type { ClientDetail } from "@/types/view"

/** Email (mailto), phone (tel), WhatsApp chat (wa.me without text) and notes (docs/06 §4.7). */
export function ContactCard({ client }: { client: ClientDetail }) {
  const editHref = `/clients/${client.id}/edit`
  const phone = client.phone ? formatPhone(client.phone) : null

  return (
    <section
      aria-labelledby="contact-title"
      className="rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      <h2 id="contact-title" className="text-base font-semibold">
        Contact
      </h2>
      <ul className="mt-3 flex flex-col">
        <Row icon={MailIcon} label="Email">
          {client.email ? (
            <a
              href={`mailto:${client.email}`}
              className="truncate text-ink hover:underline"
            >
              {client.email}
            </a>
          ) : (
            <Missing href={editHref}>No email</Missing>
          )}
        </Row>
        <Row icon={PhoneIcon} label="Phone">
          {client.phone ? (
            <a
              href={`tel:+${client.phone}`}
              className="text-ink tabular-nums hover:underline"
            >
              {phone}
            </a>
          ) : (
            <Missing href={editHref}>No phone</Missing>
          )}
        </Row>
        <Row icon={MessageCircleIcon} label="WhatsApp">
          {client.phone ? (
            <a
              href={buildWaLink(client.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 hover:underline"
            >
              Open chat
            </a>
          ) : (
            <span className="text-ink-subtle">No valid WhatsApp number</span>
          )}
        </Row>
        <Row icon={BanknoteIcon} label="Default currency">
          <span
            className="truncate text-ink"
            title="New subscriptions, invoices and payments start in it"
          >
            <span className="font-mono">{client.currency}</span>
            <span className="text-ink-muted"> · {currencyName(client.currency)}</span>
          </span>
        </Row>
        {/* Optional: nothing is shown when there's no address. */}
        {client.address && (
          <Row icon={MapPinIcon} label="Billing address" multiline>
            <span className="wrap-break-word whitespace-pre-line text-ink">
              {client.address}
            </span>
          </Row>
        )}
      </ul>
      {client.notes && (
        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-medium text-ink-muted">Notes</h3>
          <p className="mt-1 text-base whitespace-pre-wrap text-ink">{client.notes}</p>
        </div>
      )}
    </section>
  )
}

function Row({
  icon: Icon,
  label,
  multiline = false,
  children,
}: {
  icon: LucideIcon
  label: string
  /** Top-aligned for text that wraps (the address). */
  multiline?: boolean
  children: React.ReactNode
}) {
  return (
    <li
      className={
        multiline
          ? "flex min-h-10 items-start gap-3 py-2 text-base"
          : "flex min-h-10 items-center gap-3 text-base"
      }
    >
      <Icon
        aria-hidden
        className={
          multiline
            ? "mt-1 size-4 shrink-0 text-ink-subtle"
            : "size-4 shrink-0 text-ink-subtle"
        }
      />
      <span className="sr-only">{label}:</span>
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </li>
  )
}

function Missing({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <>
      <span className="text-ink-subtle">{children}</span>
      <Link href={href} className="text-sm font-medium text-brand-700 hover:underline">
        Add
      </Link>
    </>
  )
}
