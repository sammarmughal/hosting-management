// docs/10 §1 reminders.int.test.ts, against the hrm_test database.
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { addDays } from "@/lib/domain/dates"
import { encrypt } from "@/lib/server/crypto"
import { prisma } from "@/lib/server/db"
import { fromDbDate, toDbDate } from "@/lib/server/db-dates"
import { devOutbox } from "@/lib/server/mail"
import { renewService } from "@/lib/server/renewals"
import {
  runCheck,
  sendAdminSummaryEmail,
  sendReminderEmail,
  setReminderStatus,
} from "@/lib/server/reminders"
import { updateSettings } from "@/lib/server/settings"
import { SETTING_DEFAULTS } from "@/lib/server/settings-keys"

import { resetDb } from "../helpers/reset-db"

const TODAY = "2026-10-10"
const enabled = !!process.env.TEST_DATABASE_URL

async function reset() {
  await resetDb(prisma, ["clients", "settings", "message_templates", "audit_log"])
  for (const [key, value] of Object.entries(SETTING_DEFAULTS))
    await prisma.setting.create({ data: { key, value } })
  await updateSettings({
    admin_email: "billing@rehmanweb.pk",
    admin_whatsapp: "923001112233",
    business_name: "Rehman Web Services",
    mail_from_email: "billing@rehmanweb.pk",
  })
  devOutbox().length = 0
  process.env.FAKE_TODAY = TODAY
  process.env.MAIL_TRANSPORT = "json"
}

async function service(
  days: number,
  client: { email?: string | null; phone?: string | null } = {}
) {
  const renewal = addDays(TODAY, days)
  const c = await prisma.client.create({
    data: {
      name: `Client d${days}`,
      email: client.email === undefined ? `d${days}@client.pk` : client.email,
      phone: client.phone === undefined ? "923001234567" : client.phone,
      currency: "PKR",
      services: {
        create: {
          domain: `d${days >= 0 ? days : `m${-days}`}.pk`,
          startDate: toDbDate(addDays(renewal, -365)),
          renewalDate: toDbDate(renewal),
          chargeAmount: "6500.00",
        },
      },
    },
    include: { services: true },
  })
  return c.services[0]!
}

const rowsFor = (serviceId: number) =>
  prisma.reminder.findMany({ where: { serviceId }, orderBy: { id: "asc" } })

describe.skipIf(!enabled)("runCheck (docs/10 §1)", () => {
  beforeEach(reset)
  afterAll(() => prisma.$disconnect())

  it("skips while another check holds the lock, and runs once it's free", async () => {
    await service(12)
    let release!: () => void
    const held = new Promise<void>((r) => (release = r))
    let locked!: () => void
    const isLocked = new Promise<void>((r) => (locked = r))
    // Another "check" takes the lock row and keeps its transaction open.
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT name FROM app_locks WHERE name = 'check' FOR UPDATE`
        locked()
        await held
      },
      { timeout: 10_000 }
    )
    await isLocked
    const blocked = await runCheck({ force: true })
    expect(blocked.ran).toBe(false)
    expect(await prisma.reminder.count()).toBe(0)
    release()
    await holder
    const free = await runCheck({ force: true })
    expect(free.ran).toBe(true)
    expect(free.queuedNew).toBe(4)
  })

  it("two parallel checks never create duplicates", async () => {
    await service(30)
    await service(12)
    await service(-4)
    for (let round = 0; round < 5; round++) {
      const results = await Promise.all([runCheck({ force: true }), runCheck({ force: true })])
      if (round === 0) {
        // Whichever ran first queued everything; the other found the lock
        // held (ran: false) or, if it came after, nothing left to queue.
        expect(results.reduce((n, r) => n + r.queuedNew, 0)).toBe(12)
        expect(results.reduce((n, r) => n + r.invoicesNew, 0)).toBe(3)
        expect(results.some((r) => r.ran)).toBe(true)
      } else {
        expect(results.every((r) => r.queuedNew === 0 && r.invoicesNew === 0)).toBe(true)
      }
    }
    expect(await prisma.reminder.count()).toBe(12)
    expect(await prisma.notification.count({ where: { type: { not: "invoice_created" } } })).toBe(3)
    expect(await prisma.invoice.count()).toBe(3)
    const numbers = await prisma.invoice.findMany({ select: { number: true } })
    expect(new Set(numbers.map((n) => n.number)).size).toBe(3)
  })

  it("queues the due stages once, catches up, and skips superseded rows", async () => {
    const s45 = await service(45)
    const s30 = await service(30)
    const s12 = await service(12)
    const s0 = await service(0)
    const sm4 = await service(-4)

    // 1. Four services queued at stages 30, 15, 0, −3; d = 45 is skipped.
    const first = await runCheck({ force: true })
    expect(first.ran).toBe(true)
    expect(first.notificationsNew).toBe(4)
    expect(await rowsFor(s45.id)).toHaveLength(0)
    for (const [s, stage] of [
      [s30, 30],
      [s12, 15],
      [s0, 0],
      [sm4, -3],
    ] as const) {
      const rows = await rowsFor(s.id)
      // client email + WhatsApp, admin email + WhatsApp
      expect(rows).toHaveLength(4)
      expect(new Set(rows.map((r) => r.stage))).toEqual(new Set([stage]))
    }
    expect(first.queuedNew).toBe(16)

    // 2. Running again adds nothing (unique keys + dedupe keys).
    const again = await runCheck({ force: true })
    expect([again.queuedNew, again.notificationsNew]).toEqual([0, 0])

    // 3. Eight days later: d=22 is still stage 30 (nothing new); d=4 → stage 7,
    //    and the pending stage-15 rows become skipped.
    process.env.FAKE_TODAY = addDays(TODAY, 8)
    const later = await runCheck({ force: true })
    expect((await rowsFor(s30.id)).map((r) => r.stage)).toEqual([30, 30, 30, 30])
    const rows12 = await rowsFor(s12.id)
    expect(rows12.filter((r) => r.stage === 15).every((r) => r.status === "skipped")).toBe(true)
    expect(rows12.filter((r) => r.stage === 7)).toHaveLength(4)
    expect(later.skipped).toBeGreaterThanOrEqual(4)
  })

  it("renewing skips the old cycle and the next check queues nothing for it", async () => {
    const s0 = await service(0)
    await runCheck({ force: true })
    const newDate = await renewService({
      serviceId: s0.id,
      amount: "6500",
      paidOn: TODAY,
      method: "Cash",
      extendFrom: "renewal",
    })
    expect(newDate).toBe("2027-10-10")
    expect((await rowsFor(s0.id)).every((r) => r.status === "skipped")).toBe(true)
    const after = await runCheck({ force: true })
    expect(after.queuedNew).toBe(0)
    const svc = await prisma.service.findUniqueOrThrow({ where: { id: s0.id } })
    expect(fromDbDate(svc.renewalDate)).toBe("2027-10-10")
    expect(await prisma.payment.count({ where: { serviceId: s0.id } })).toBe(1)
  })

  it("a client without email gets a WhatsApp row but no email row", async () => {
    const s = await service(7, { email: null })
    await runCheck({ force: true })
    const client = (await rowsFor(s.id)).filter((r) => r.recipient === "client")
    expect(client.map((r) => r.channel)).toEqual(["whatsapp"])
  })

  it("post_expiry_to_client = 0 queues admin rows only after expiry", async () => {
    await updateSettings({ post_expiry_to_client: "0" })
    const s = await service(-4)
    await runCheck({ force: true })
    expect((await rowsFor(s.id)).map((r) => r.recipient)).toEqual(["admin", "admin"])
  })

  it("respects the check interval unless forced", async () => {
    await service(7)
    expect((await runCheck({ force: false })).ran).toBe(true)
    const throttled = await runCheck({ force: false })
    expect(throttled.ran).toBe(false)
    expect(throttled.queuedNew).toBe(0)
  })
})

describe.skipIf(!enabled)("sending (docs/04 §5)", () => {
  beforeEach(reset)

  it("sends a client email and marks the row sent", async () => {
    const s = await service(3)
    await runCheck({ force: true })
    const row = (await rowsFor(s.id)).find(
      (r) => r.channel === "email" && r.recipient === "client"
    )!
    const res = await sendReminderEmail(row.id)
    expect(res.ok).toBe(true)
    const saved = await prisma.reminder.findUniqueOrThrow({ where: { id: row.id } })
    expect(saved.status).toBe("sent")
    expect(saved.sentAt).not.toBeNull()
    const mail = devOutbox().at(-1)!
    expect(mail.to).toBe("d3@client.pk")
    expect(mail.subject).toContain("d3.pk")
    expect(mail.text).toContain("PKR 6,500")
    // Already handled: a second send is refused.
    expect((await sendReminderEmail(row.id)).ok).toBe(false)
  })

  it("stores the real SMTP error on the row and raises a notification", async () => {
    process.env.MAIL_TRANSPORT = "smtp"
    // Nothing listens on port 1: the connection is refused.
    await updateSettings({
      smtp_host: "127.0.0.1",
      smtp_port: "1",
      smtp_encryption: "None",
      smtp_username: "billing@rehmanweb.pk",
      smtp_password_enc: encrypt("secret"),
    })
    const s = await service(3)
    await runCheck({ force: true })
    const row = (await rowsFor(s.id)).find(
      (r) => r.channel === "email" && r.recipient === "client"
    )!
    const res = await sendReminderEmail(row.id)
    expect(res.ok).toBe(false)
    const saved = await prisma.reminder.findUniqueOrThrow({ where: { id: row.id } })
    expect(saved.status).toBe("failed")
    expect(saved.attempts).toBe(1)
    expect(saved.lastError).toMatch(/ECONNREFUSED/)
    expect(res.ok ? "" : res.error).toBe(saved.lastError)
    const n = await prisma.notification.findFirstOrThrow({ where: { type: "email_failed" } })
    expect(n.title).toBe("Email to Client d3 failed")
  })

  it("sends one admin summary for all queued services and marks those rows sent", async () => {
    await service(3)
    await service(-4)
    await runCheck({ force: true })
    const res = await sendAdminSummaryEmail()
    expect(res).toEqual({ ok: true, count: 2 })
    expect(devOutbox().at(-1)!.to).toBe("billing@rehmanweb.pk")
    const adminEmails = await prisma.reminder.findMany({
      where: { recipient: "admin", channel: "email" },
    })
    expect(adminEmails.every((r) => r.status === "sent")).toBe(true)
  })

  it("WhatsApp rows go opened → sent, and can't be reopened after sending", async () => {
    const s = await service(3)
    await runCheck({ force: true })
    const wa = (await rowsFor(s.id)).find(
      (r) => r.channel === "whatsapp" && r.recipient === "client"
    )!
    expect((await setReminderStatus(wa.id, "opened")).ok).toBe(true)
    expect((await setReminderStatus(wa.id, "sent")).ok).toBe(true)
    expect((await setReminderStatus(wa.id, "opened")).ok).toBe(false)
  })
})
