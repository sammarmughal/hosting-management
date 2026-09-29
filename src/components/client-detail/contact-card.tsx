import { MailIcon, MessageCircleIcon, PhoneIcon, type LucideIcon } from "lucide-react"
import Link from "next/link"

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
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="flex min-h-10 items-center gap-3 text-base">
      <Icon aria-hidden className="size-4 shrink-0 text-ink-subtle" />
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
