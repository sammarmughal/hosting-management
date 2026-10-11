import "server-only"

import nodemailer from "nodemailer"

import { oneLine } from "@/lib/domain/messages"
import { decrypt } from "@/lib/server/crypto"
import type { AppSettings } from "@/lib/server/settings"

// nodemailer over the SMTP account from Settings → Email (docs/08 §7). A new
// transport per send (serverless). In development and tests,
// MAIL_TRANSPORT=json uses nodemailer's jsonTransport instead: nothing is
// sent, and the message is logged and kept in `devOutbox()`.

export interface OutgoingMail {
  to: string
  subject: string
  html: string
  text: string
  /** e.g. the invoice PDF (docs/13 §9–§10). */
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}

export interface SentMail extends Omit<OutgoingMail, "attachments"> {
  /** Attachment file names (the content isn't kept). */
  attachments: string[]
  messageId: string
  from: string
  at: string
}

/** Not used in production: MAIL_TRANSPORT=json is ignored there. */
function jsonTransportEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.MAIL_TRANSPORT === "json"
}

const store = globalThis as typeof globalThis & { __devOutbox?: SentMail[] }
/** Messages "sent" with the json transport (newest last). */
export const devOutbox = (): SentMail[] => (store.__devOutbox ??= [])

export class MailError extends Error {}

function transportFor(smtp: AppSettings["smtp"]) {
  if (jsonTransportEnabled()) return nodemailer.createTransport({ jsonTransport: true })
  if (!smtp.host || !smtp.fromEmail)
    throw new MailError(
      "Email isn’t set up yet. Add your SMTP details in Settings → Email."
    )
  let pass = ""
  if (smtp.passwordEnc) {
    try {
      pass = decrypt(smtp.passwordEnc)
    } catch {
      throw new MailError(
        "The saved SMTP password can’t be read (APP_KEY changed?). Enter it again in Settings → Email."
      )
    }
  }
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.encryption === "SSL",
    requireTLS: smtp.encryption === "TLS",
    ignoreTLS: smtp.encryption === "None",
    auth: smtp.username ? { user: smtp.username, pass } : undefined,
    // Short limits: one email per request on serverless (CLAUDE.md rule 10).
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
}

/** Sends one email. Throws MailError with the SMTP server's message on failure. */
export async function sendMail(
  settings: Pick<AppSettings, "smtp" | "adminEmail">,
  mail: OutgoingMail
): Promise<SentMail> {
  const { smtp } = settings
  const transport = transportFor(smtp)
  const from = { name: oneLine(smtp.fromName || smtp.fromEmail), address: smtp.fromEmail }
  try {
    const info = await transport.sendMail({
      from: smtp.fromEmail ? from : undefined,
      to: mail.to,
      replyTo: settings.adminEmail || undefined,
      subject: oneLine(mail.subject),
      html: mail.html,
      text: mail.text,
      attachments: mail.attachments,
    })
    const sent: SentMail = {
      ...mail,
      attachments: (mail.attachments ?? []).map((a) => a.filename),
      from: smtp.fromEmail,
      messageId: info.messageId,
      at: new Date().toISOString(),
    }
    if (jsonTransportEnabled()) {
      devOutbox().push(sent)
      if (process.env.NODE_ENV === "development")
        console.info(`[mail:json] to=${mail.to} subject="${sent.subject}"`)
    }
    return sent
  } catch (err) {
    throw new MailError(smtpErrorText(err))
  } finally {
    transport.close()
  }
}

/** The server's own words, trimmed to fit reminders.last_error (500). */
export function smtpErrorText(err: unknown): string {
  const e = err as { response?: string; message?: string; code?: string }
  const text = e?.response || e?.message || String(err)
  const withCode = e?.code && !text.includes(e.code) ? `${e.code}: ${text}` : text
  return oneLine(withCode).slice(0, 500)
}
