// `npx prisma db seed` (docs/03 §7): default settings + templates, idempotent.
// `SEED_DEMO=1` (development only) also loads the demo clients, services,
// payments, reminders and notifications, plus a demo admin, into an empty DB.
import { hash } from "@node-rs/argon2"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { PrismaClient } from "@/generated/prisma/client"
import { addDays, todayPK, type ISODate } from "@/lib/domain/dates"
import { DEFAULT_TEMPLATES } from "@/lib/domain/default-templates"
import { dueStage, parseStages } from "@/lib/domain/stages"
import { PAYMENT_METHOD_KEYS, type PaymentMethod } from "@/lib/domain/validation"
import { normalisePhone } from "@/lib/domain/whatsapp"
import { mariadbConfig } from "@/lib/db-config"
import { toDbDate } from "@/lib/server/db-dates"
import { SETTING_DEFAULTS } from "@/lib/server/settings-keys"

import { CLIENTS, NOTIFICATIONS, PAYMENTS, REMINDERS } from "./demo-data"

try {
  process.loadEnvFile(".env")
} catch {
  // Rely on the environment.
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(mariadbConfig(process.env.DATABASE_URL)),
})

/** The start of the yearly cycle. 29 Feb → 28 Feb when needed. */
function minusOneYear(d: ISODate): ISODate {
  const [y = "", m = "", day = ""] = d.split("-")
  const py = Number(y) - 1
  const leap = (py % 4 === 0 && py % 100 !== 0) || py % 400 === 0
  return `${py}-${m}-${m === "02" && day === "29" && !leap ? "28" : day}`
}

/** Most frequent code; ties go to PKR (the default), then alphabetical. */
function mostUsedCurrency(codes: string[]): string | null {
  const counts = new Map<string, number>()
  for (const c of codes) counts.set(c, (counts.get(c) ?? 0) + 1)
  const ranked = [...counts].sort(
    ([a, x], [b, y]) => y - x || Number(b === "PKR") - Number(a === "PKR") || a.localeCompare(b)
  )
  return ranked[0]?.[0] ?? null
}

async function seedDefaults() {
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value }, update: {} })
  }
  for (const [key, t] of Object.entries(DEFAULT_TEMPLATES)) {
    await prisma.messageTemplate.upsert({
      where: { key },
      create: { key, subject: t.subject ?? null, body: t.body },
      update: {},
    })
  }
  console.log("Settings and templates: ok")
}

async function seedDemo() {
  if ((await prisma.client.count()) > 0) {
    console.log("Demo data: skipped (the database already has clients)")
    return
  }
  const now = Date.now()
  const today = todayPK()
  const ago = (min: number) => new Date(now - min * 60_000)
  const stages = parseStages(SETTING_DEFAULTS.reminder_stages)

  // The demo business (as in the approved UI demo).
  const business = {
    business_name: "Rehman Web Services",
    business_phone: "+92 300 1112233",
    admin_email: "billing@rehmanweb.pk",
    admin_whatsapp: "923001112233",
    smtp_username: "billing@rehmanweb.pk",
    mail_from_email: "billing@rehmanweb.pk",
    mail_from_name: "Rehman Web Services",
  }
  for (const [key, value] of Object.entries(business)) {
    await prisma.setting.update({ where: { key }, data: { value } })
  }

  if ((await prisma.admin.count()) === 0) {
    await prisma.admin.create({
      data: {
        username: "rehman",
        email: "billing@rehmanweb.pk",
        passwordHash: await hash("Renewals2026!"),
      },
    })
    console.log("Demo admin: rehman / Renewals2026! (2FA is set up at first login)")
  }

  /** demo service id → { db id, renewal date, days left, amount, currency } */
  const services = new Map<
    number,
    { id: number; renewal: ISODate; days: number; amount: string; currency: string }
  >()
  for (const c of CLIENTS) {
    const client = await prisma.client.create({
      data: {
        name: c.name,
        company: c.company,
        email: c.email,
        phone: normalisePhone(c.phone),
        address: c.address ?? null,
        // Like the migration backfill: the currency most of their services use.
        currency: mostUsedCurrency(c.services.map((s) => s.currency ?? "PKR")) ?? "PKR",
        notes: c.notes,
      },
    })
    for (const s of c.services) {
      const days = s.days ?? 365
      const renewal = addDays(today, days)
      const currency = s.currency ?? "PKR"
      const row = await prisma.service.create({
        data: {
          clientId: client.id,
          domain: s.domain,
          planLabel: s.plan,
          startDate: toDbDate(minusOneYear(renewal)),
          renewalDate: toDbDate(renewal),
          chargeAmount: s.amount,
          currency,
          status: s.status ?? "active",
          remindersEnabled: s.remindersEnabled ?? true,
          notes: s.notes ?? null,
        },
      })
      services.set(s.id, { id: row.id, renewal, days, amount: s.amount, currency })
    }
  }

  for (const p of PAYMENTS) {
    const s = services.get(p.serviceId)
    if (!s) continue
    const periodFrom = minusOneYear(s.renewal)
    await prisma.payment.create({
      data: {
        serviceId: s.id,
        amount: s.amount,
        currency: s.currency,
        paidOn: toDbDate(addDays(periodFrom, -p.paidEarly)),
        method: PAYMENT_METHOD_KEYS[p.method as PaymentMethod] ?? "other",
        reference: p.reference,
        periodFrom: toDbDate(periodFrom),
        periodTo: toDbDate(s.renewal),
      },
    })
  }

  for (const r of REMINDERS) {
    const s = services.get(r.serviceId)
    if (!s) continue
    await prisma.reminder.create({
      data: {
        serviceId: s.id,
        cycleDate: toDbDate(s.renewal),
        stage: dueStage(s.days, stages) ?? s.days,
        channel: r.channel,
        recipient: "client",
        status: r.status,
        attempts: r.status === "failed" || r.status === "sent" ? 1 : 0,
        lastError: r.error ?? null,
        sentAt: r.agoMin !== undefined ? ago(r.agoMin) : null,
      },
    })
  }

  const clientNames = new Map(
    CLIENTS.flatMap((c) => c.services.map((s) => [s.id, c.name] as const))
  )
  for (const n of NOTIFICATIONS) {
    const s = services.get(n.serviceId)
    const svc = CLIENTS.flatMap((c) => c.services).find((x) => x.id === n.serviceId)
    if (!s || !svc) continue
    await prisma.notification.create({
      data: {
        serviceId: s.id,
        type: n.type,
        title: n.title({
          domain: svc.domain,
          clientName: clientNames.get(n.serviceId) ?? "",
          daysLeft: s.days,
          renewalDate: s.renewal,
        }),
        dedupeKey: `demo:${n.id}`,
        isRead: n.isRead,
        createdAt: ago(n.agoMin),
      },
    })
  }
  console.log(
    `Demo data: ${CLIENTS.length} clients, ${services.size} services, ${PAYMENTS.length} payments`
  )
}

async function main() {
  await seedDefaults()
  if (process.env.SEED_DEMO === "1") {
    if (process.env.NODE_ENV === "production") {
      console.log("SEED_DEMO is ignored in production")
    } else {
      await seedDemo()
    }
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
