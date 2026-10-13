// docs/13 §12 (integration part), against the hrm_test database.
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { addDays } from "@/lib/domain/dates"
import { prisma } from "@/lib/server/db"
import { fromDbDate, toDbDate } from "@/lib/server/db-dates"
import { getInvoice, getInvoiceByToken, listInvoices } from "@/lib/server/invoice-queries"
import { renderInvoicePdf } from "@/lib/server/invoice-pdf"
import { buildShareData, recordWhatsappOpened, shareByEmail } from "@/lib/server/invoice-share"
import {
  allocateInvoiceNumber,
  createInvoiceNow,
  refreshBusinessDetails,
  regeneratePublicLink,
  updateFromService,
  voidInvoice,
} from "@/lib/server/invoices"
import { devOutbox } from "@/lib/server/mail"
import { lookupPublicInvoice } from "@/lib/server/public-invoice"
import { runCheck, sendReminderEmail } from "@/lib/server/reminders"
import { renewService } from "@/lib/server/renewals"
import { updateSettings } from "@/lib/server/settings"
import { SETTING_DEFAULTS } from "@/lib/server/settings-keys"

import { AE_ACCOUNT, FAKE_IBAN, PK_ACCOUNT, TEST_ACCOUNTS } from "../helpers/payment-fixtures"
import { resetDb } from "../helpers/reset-db"

const TODAY = "2026-10-10"
const enabled = !!process.env.TEST_DATABASE_URL

async function reset() {
  await resetDb(prisma, ["clients", "settings", "message_templates", "audit_log", "invoice_counters", "rate_limits"])
  for (const [key, value] of Object.entries(SETTING_DEFAULTS))
    await prisma.setting.create({ data: { key, value } })
  await updateSettings({
    admin_email: "billing@rehmanweb.pk",
    business_name: "Rehman Web Services",
    mail_from_email: "billing@rehmanweb.pk",
    business_address: "Office 12, Blue Area, Islamabad",
    payment_accounts: JSON.stringify(TEST_ACCOUNTS),
  })
  devOutbox().length = 0
  process.env.FAKE_TODAY = TODAY
  process.env.MAIL_TRANSPORT = "json"
}

async function service(
  days: number,
  opts: { status?: "active" | "cancelled"; currency?: string; amount?: string; email?: string | null } = {}
) {
  const renewal = addDays(TODAY, days)
  const c = await prisma.client.create({
    data: {
      name: `Client d${days}`,
      company: "Noor Dental Clinic",
      address: "Shop 3, Jail Road, Lahore",
      currency: opts.currency ?? "PKR",
      email: opts.email === undefined ? `d${days}@client.pk` : opts.email,
      phone: "923001234567",
      services: {
        create: {
          domain: `d${days >= 0 ? days : `m${-days}`}.pk`,
          planLabel: "Business",
          startDate: toDbDate(addDays(renewal, -365)),
          renewalDate: toDbDate(renewal),
          chargeAmount: opts.amount ?? "8750.00",
          currency: opts.currency ?? "PKR",
          status: opts.status ?? "active",
        },
      },
    },
    include: { services: true },
  })
  return c.services[0]!
}

describe.skipIf(!enabled)("invoices (docs/13 §2–§5)", () => {
  beforeEach(reset)
  afterAll(() => prisma.$disconnect())

  it("numbers per year, gap-free, safe under concurrency (§3)", async () => {
    const numbers = await Promise.all(
      Array.from({ length: 12 }, () =>
        prisma.$transaction((tx) => allocateInvoiceNumber(tx, TODAY, "INV"))
      )
    )
    expect(new Set(numbers).size).toBe(12)
    expect([...numbers].sort()).toEqual(
      Array.from({ length: 12 }, (_, i) => `INV-2026-${String(i + 1).padStart(4, "0")}`)
    )
    const nextYear = await prisma.$transaction((tx) => allocateInvoiceNumber(tx, "2027-01-01", "INV"))
    expect(nextYear).toBe("INV-2027-0001")
    // A rolled-back transaction doesn't use up a number.
    await expect(
      prisma.$transaction(async (tx) => {
        await allocateInvoiceNumber(tx, TODAY, "INV")
        throw new Error("rollback")
      })
    ).rejects.toThrow("rollback")
    const after = await prisma.$transaction((tx) => allocateInvoiceNumber(tx, TODAY, "INV"))
    expect(after).toBe("INV-2026-0013")
  })

  it("two parallel 'Create invoice now' clicks make one invoice and use one number", async () => {
    const s = await service(20)
    for (let round = 0; round < 5; round++) {
      const results = await Promise.all([createInvoiceNow(s.id), createInvoiceNow(s.id)])
      for (const r of results) expect(r).not.toHaveProperty("error")
      const ok = results as { id: number; number: string; created: boolean }[]
      // Both answers point at the same invoice; at most one of them made it.
      expect(new Set(ok.map((r) => r.id)).size).toBe(1)
      expect(ok.filter((r) => r.created).length).toBe(round === 0 ? 1 : 0)
    }
    expect(await prisma.invoice.count({ where: { serviceId: s.id } })).toBe(1)
    // The losing transaction rolled back its number: no gap.
    const next = await prisma.$transaction((tx) => allocateInvoiceNumber(tx, TODAY, "INV"))
    expect(next).toBe("INV-2026-0002")
  })

  it("stores timestamps in UTC whatever the server clock's zone", async () => {
    const at = new Date("2026-10-10T23:30:15.123Z")
    const row = await prisma.auditLog.create({ data: { action: "test.utc", createdAt: at } })
    const back = await prisma.auditLog.findUniqueOrThrow({ where: { id: row.id } })
    expect(back.createdAt.toISOString()).toBe(at.toISOString())
    // A server-side default (CURRENT_TIMESTAMP) lands in UTC too.
    const [raw] = await prisma.$queryRaw<{ diff: bigint | number }[]>`
      SELECT ABS(TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(3), CURRENT_TIMESTAMP(3))) AS diff`
    expect(Number(raw?.diff)).toBeLessThan(5)
    const fresh = await prisma.invoiceCounter.create({ data: { year: 1999 } })
    expect(Math.abs(fresh.updatedAt.getTime() - Date.now())).toBeLessThan(60_000)
  })

  it("the daily check creates one invoice per cycle inside the lead window (§4)", async () => {
    const in20 = await service(20)
    const in45 = await service(45)
    const cancelled = await service(5, { status: "cancelled" })
    const first = await runCheck({ force: true })
    expect(first.invoicesNew).toBe(1)
    const again = await runCheck({ force: true })
    expect(again.invoicesNew).toBe(0)

    const invoices = await prisma.invoice.findMany()
    expect(invoices.map((i) => i.serviceId)).toEqual([in20.id])
    expect(await prisma.invoice.count({ where: { serviceId: { in: [in45.id, cancelled.id] } } })).toBe(0)
    const inv = invoices[0]!
    expect(inv.number).toBe("INV-2026-0001")
    expect(fromDbDate(inv.periodStart)).toBe(addDays(TODAY, 20))
    expect(fromDbDate(inv.periodEnd)).toBe("2027-10-30")
    expect(fromDbDate(inv.dueDate)).toBe(addDays(TODAY, 20))
    expect(inv.status).toBe("issued")
    const n = await prisma.notification.findFirstOrThrow({ where: { type: "invoice_created" } })
    expect(n.title).toBe("Invoice INV-2026-0001 created for d20.pk")

    // Lead days 15 → a 20-day service is outside; 45 days with 60 → inside.
    await updateSettings({ invoice_lead_days: "60" })
    expect((await runCheck({ force: true })).invoicesNew).toBe(1)
  })

  it("snapshots seller and bill-to, applies tax, and Update from service keeps the number", async () => {
    await updateSettings({ tax_enabled: "1", tax_rate: "17" })
    const s = await service(10)
    const res = await createInvoiceNow(s.id)
    if ("error" in res) throw new Error(res.error)
    let inv = await getInvoice(res.id)
    expect(inv?.seller.businessName).toBe("Rehman Web Services")
    expect(inv?.seller.payment.account?.bankName).toBe("Example Bank Pakistan")
    expect(inv?.billTo).toMatchObject({
      name: "Client d10",
      company: "Noor Dental Clinic",
      address: "Shop 3, Jail Road, Lahore",
    })
    // PKR has no minor unit in Intl, so 17% of 8,750 (1,487.50) rounds to 1,488.
    expect(inv).toMatchObject({ subtotal: "8750.000", taxAmount: "1488.000", total: "10238.000" })

    // No logo and no tagline set: the snapshot carries an empty logo and tagline.
    expect(inv?.seller).toMatchObject({ logo: "", tagline: "" })

    // Later settings changes don't touch the snapshot.
    await updateSettings({ business_name: "Renamed Business", business_tagline: "Product Designer" })
    await prisma.service.update({ where: { id: s.id }, data: { chargeAmount: "9000.00" } })
    expect((await getInvoice(res.id))?.seller.businessName).toBe("Rehman Web Services")
    // …until "Refresh business details" on an unpaid invoice.
    expect((await refreshBusinessDetails(res.id)).ok).toBe(true)
    const refreshed = await getInvoice(res.id)
    expect(refreshed?.seller.businessName).toBe("Renamed Business")
    expect(refreshed?.seller.tagline).toBe("Product Designer")
    expect(refreshed?.events.map((e) => e.type)).toContain("details_refreshed")
    await updateSettings({ business_name: "Rehman Web Services" })

    expect((await updateFromService(res.id)).ok).toBe(true)
    inv = await getInvoice(res.id)
    expect(inv?.number).toBe(res.number)
    expect(inv?.total).toBe("10530.000")
    expect(inv?.events.map((e) => e.type)).toContain("updated")

    // Manual create again is idempotent.
    const again = await createInvoiceNow(s.id)
    expect(again).toMatchObject({ id: res.id, created: false })
  })

  it("snapshots the payment account for the invoice's currency, else the Default (§11)", async () => {
    await updateSettings({ pay_wallet: "0300 0000000" })
    const pkr = await service(10)
    const aed = await service(11, { currency: "AED", amount: "500" })
    const usd = await service(12, { currency: "USD", amount: "49.99" })
    const ids = []
    for (const s of [pkr, aed, usd]) {
      const r = await createInvoiceNow(s.id)
      if ("error" in r) throw new Error(r.error)
      ids.push(r.id)
    }
    const [a, b, c] = await Promise.all(ids.map((id) => getInvoice(id)))
    expect(a?.seller.payment.account).toMatchObject({ label: "Pakistan account", iban: FAKE_IBAN.PK })
    expect(b?.seller.payment.account).toMatchObject({ label: "UAE account", iban: FAKE_IBAN.AE })
    // USD isn't assigned to an account: the Default (Pakistan) is used.
    expect(c?.seller.payment.account?.label).toBe("Pakistan account")
    // The JazzCash / Easypaisa number only on the PKR invoice.
    expect([a, b, c].map((i) => i?.seller.payment.wallet)).toEqual(["0300 0000000", "", ""])
  })

  it("Refresh business details picks the account again; paid invoices keep theirs (§11)", async () => {
    const open = await service(10, { currency: "AED", amount: "500" })
    const paid = await service(11, { currency: "AED", amount: "500" })
    const o = await createInvoiceNow(open.id)
    const p = await createInvoiceNow(paid.id)
    if ("error" in o || "error" in p) throw new Error("create failed")
    await renewService({ serviceId: paid.id, amount: "500", paidOn: TODAY, method: "Bank transfer", extendFrom: "renewal" })

    // New UAE bank details; AED moves nowhere else.
    const newUae = { ...AE_ACCOUNT, bankName: "Example Bank UAE 2", iban: FAKE_IBAN.GB, swift: "" }
    await updateSettings({ payment_accounts: JSON.stringify([PK_ACCOUNT, newUae]) })
    // Unchanged until refreshed.
    expect((await getInvoice(o.id))?.seller.payment.account?.bankName).toBe("Example Bank UAE")
    expect((await refreshBusinessDetails(o.id)).ok).toBe(true)
    expect((await getInvoice(o.id))?.seller.payment.account).toMatchObject({
      bankName: "Example Bank UAE 2",
      iban: FAKE_IBAN.GB,
      swift: "",
    })

    // Paid: locked, still the old account.
    expect((await refreshBusinessDetails(p.id)).ok).toBe(false)
    expect((await getInvoice(p.id))?.seller.payment.account?.bankName).toBe("Example Bank UAE")

    // AED taken off its account: a refresh falls back to the Default.
    await updateSettings({ payment_accounts: JSON.stringify([PK_ACCOUNT, { ...newUae, currencies: [] }]) })
    expect((await refreshBusinessDetails(o.id)).ok).toBe(true)
    expect((await getInvoice(o.id))?.seller.payment.account?.label).toBe("Pakistan account")
  })

  it("Update from service switches the account when the currency changes", async () => {
    const s = await service(10)
    const r = await createInvoiceNow(s.id)
    if ("error" in r) throw new Error(r.error)
    expect((await getInvoice(r.id))?.seller.payment.account?.label).toBe("Pakistan account")
    await prisma.service.update({ where: { id: s.id }, data: { currency: "AED", chargeAmount: "500" } })
    expect((await updateFromService(r.id)).ok).toBe(true)
    const inv = await getInvoice(r.id)
    expect(inv?.currency).toBe("AED")
    expect(inv?.seller.payment.account?.label).toBe("UAE account")
    // The rest of the business snapshot is untouched.
    expect(inv?.seller.businessName).toBe("Rehman Web Services")
  })

  it("rounds tax to each currency's minor unit: USD cents, KWD fils (§6)", async () => {
    await updateSettings({ tax_enabled: "1", tax_rate: "17" })
    const usd = await service(10, { currency: "USD", amount: "49.99" })
    const kwd = await service(11, { currency: "KWD", amount: "12.345" })
    const a = await createInvoiceNow(usd.id)
    const b = await createInvoiceNow(kwd.id)
    if ("error" in a || "error" in b) throw new Error("create failed")
    // 17% of 49.99 = 8.4983 → 8.50; 17% of 12.345 = 2.09865 → 2.099
    expect(await getInvoice(a.id)).toMatchObject({ currency: "USD", taxAmount: "8.500", total: "58.490" })
    expect(await getInvoice(b.id)).toMatchObject({ currency: "KWD", taxAmount: "2.099", total: "14.444" })
  })

  it("renewing marks the cycle's invoice paid and links the payment (§5)", async () => {
    const s = await service(3)
    const res = await createInvoiceNow(s.id)
    if ("error" in res) throw new Error(res.error)
    const newDate = await renewService({
      serviceId: s.id,
      amount: "8750",
      paidOn: TODAY,
      method: "Bank transfer",
      extendFrom: "renewal",
    })
    expect(newDate).toBe("2027-10-13")
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: res.id } })
    expect(inv.status).toBe("paid")
    expect(fromDbDate(inv.paidAt!)).toBe(TODAY)
    expect(inv.paymentId).not.toBeNull()
    // Paid invoices are locked.
    expect((await updateFromService(res.id)).ok).toBe(false)
    expect((await refreshBusinessDetails(res.id)).ok).toBe(false)
    expect((await voidInvoice(res.id, null)).ok).toBe(false)
  })

  it("voids with a reason, keeps the number, and lists per-currency totals", async () => {
    const pkr = await service(5)
    const usd = await service(6, { currency: "USD", amount: "49.99" })
    const a = await createInvoiceNow(pkr.id)
    const b = await createInvoiceNow(usd.id)
    if ("error" in a || "error" in b) throw new Error("create failed")
    expect((await voidInvoice(a.id, "Client moved away")).ok).toBe(true)
    const v = await getInvoice(a.id)
    expect(v).toMatchObject({ rawStatus: "void", number: "INV-2026-0001", voidReason: "Client moved away" })

    const list = await listInvoices({ q: "", status: "all", currency: "", from: "", to: "", page: 1 })
    expect(list.total).toBe(2)
    expect(list.invoiced).toEqual([{ currency: "USD", total: "49.990" }])
    const voidOnly = await listInvoices({ q: "", status: "void", currency: "", from: "", to: "", page: 1 })
    expect(voidOnly.rows.map((r) => r.number)).toEqual(["INV-2026-0001"])
  })
})

describe.skipIf(!enabled)("PDF, public link and sharing (docs/13 §7–§10)", () => {
  beforeEach(reset)

  it("renders an A4 PDF for a long company name and a USD invoice", async () => {
    const s = await service(4, { currency: "USD", amount: "49.99" })
    await prisma.client.update({
      where: { id: s.clientId },
      data: { name: "Al-Madina Textiles (Pvt) Ltd, Faisalabad Head Office & Export Division" },
    })
    const res = await createInvoiceNow(s.id)
    if ("error" in res) throw new Error(res.error)
    const inv = await getInvoice(res.id)
    const pdf = await renderInvoicePdf(inv!)
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(pdf.length).toBeGreaterThan(5_000)
  })

  it("renders the wordmark header with no logo: plain, with a tagline, long name, and with a logo", async () => {
    const s = await service(9)
    const res = await createInvoiceNow(s.id)
    if ("error" in res) throw new Error(res.error)
    const inv = (await getInvoice(res.id))!
    const PNG_1PX =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    const variants = [
      { businessName: "Abdul Rehmaan", tagline: "", logo: "" },
      { businessName: "Abdul Rehmaan", tagline: "Senior UI/UX & Product Designer", logo: "" },
      {
        businessName: "Abdul Rehmaan Design Studio — UI/UX, Product Design & Brand Identity Services (Private) Limited",
        tagline: "Senior UI/UX & Product Designer · Websites, dashboards and mobile apps",
        logo: "",
      },
      { businessName: "Abdul Rehmaan", tagline: "Designer", logo: PNG_1PX },
    ]
    for (const v of variants) {
      const pdf = await renderInvoicePdf({ ...inv, seller: { ...inv.seller, ...v } })
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
      // One A4 page, whatever the header holds.
      expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1)
    }
  })

  it("serves the invoice by token, rejects others, and regenerating revokes the old link", async () => {
    const s = await service(4)
    const res = await createInvoiceNow(s.id)
    if ("error" in res) throw new Error(res.error)
    const { publicToken } = await prisma.invoice.findUniqueOrThrow({ where: { id: res.id } })
    expect(publicToken).toMatch(/^[0-9a-f]{64}$/)
    expect((await getInvoiceByToken(publicToken))?.document.number).toBe(res.number)
    // Right shape but unknown, and the right token in upper case: both rejected.
    expect((await lookupPublicInvoice("0".repeat(64), "203.0.113.9")).ok).toBe(false)
    expect((await lookupPublicInvoice(publicToken.toUpperCase(), "203.0.113.9")).ok).toBe(false)
    expect(await getInvoiceByToken(publicToken.toUpperCase())).toBeNull()
    expect((await lookupPublicInvoice("../etc", "203.0.113.9")).ok).toBe(false)

    const fresh = await regeneratePublicLink(res.id)
    expect(fresh).not.toBe(publicToken)
    expect(await getInvoiceByToken(publicToken)).toBeNull()
    expect((await lookupPublicInvoice(fresh!, "203.0.113.9")).ok).toBe(true)
  })

  it("rate limits /i/* per IP", async () => {
    const results = []
    for (let i = 0; i < 62; i++) results.push((await lookupPublicInvoice("y".repeat(43), "198.51.100.7")).ok)
    const limited = await lookupPublicInvoice("y".repeat(43), "198.51.100.7")
    expect(limited).toEqual({ ok: false, reason: "rate_limited" })
    // Another IP is unaffected.
    expect((await lookupPublicInvoice("y".repeat(43), "198.51.100.8"))).toEqual({ ok: false, reason: "invalid" })
  })

  it("shares by email with the PDF attached, logs it, and sets sent the first time (§9)", async () => {
    const s = await service(4)
    const res = await createInvoiceNow(s.id)
    if ("error" in res) throw new Error(res.error)
    const data = await buildShareData(res.id)
    expect(data).toMatchObject({ email: "d4@client.pk", phone: "923001234567", emailUnavailable: null })
    expect(data?.whatsappText).toContain(data!.publicUrl)
    expect(data?.emailSubject).toBe(`Invoice ${res.number} for d4.pk`)

    const sent = await shareByEmail(res.id, { subject: data!.emailSubject, text: "Hi, see attached." })
    expect(sent).toEqual({ ok: true, to: "d4@client.pk" })
    const mail = devOutbox().at(-1)!
    expect(mail.attachments).toEqual([`Invoice-${res.number}-d4.pk.pdf`])
    expect(mail.text).toContain(data!.publicUrl) // the link is always in the body
    const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: res.id } })
    expect(inv.status).toBe("sent")
    expect(inv.firstSentAt).not.toBeNull()
    expect(await prisma.reminder.count({ where: { serviceId: s.id, channel: "email", status: "sent" } })).toBe(1)

    await recordWhatsappOpened(res.id)
    const types = (await prisma.invoiceEvent.findMany({ where: { invoiceId: res.id } })).map((e) => e.type)
    expect(types).toEqual(expect.arrayContaining(["created", "email_sent", "whatsapp_opened"]))
  })

  it("a share updates the cycle's queued reminder row instead of adding a second queue item", async () => {
    const s = await service(3)
    await runCheck({ force: true }) // queues stage-3 rows and creates the invoice
    const inv = await prisma.invoice.findFirstOrThrow({ where: { serviceId: s.id } })
    process.env.FAKE_TODAY = addDays(TODAY, 1) // a day later: days left = 2
    await recordWhatsappOpened(inv.id)
    const wa = await prisma.reminder.findMany({
      where: { serviceId: s.id, channel: "whatsapp", recipient: "client" },
    })
    expect(wa).toHaveLength(1)
    expect(wa[0]).toMatchObject({ stage: 3, status: "opened" })
  })

  it("disables a channel with the reason when the client has no email", async () => {
    const s = await service(4, { email: null })
    const res = await createInvoiceNow(s.id)
    if ("error" in res) throw new Error(res.error)
    expect((await buildShareData(res.id))?.emailUnavailable).toBe("No email address for this client")
  })

  it("reminder emails attach the cycle's invoice PDF and include the link (§10)", async () => {
    const s = await service(7)
    await runCheck({ force: true }) // queues reminders and creates the invoice (7 ≤ 30)
    const row = await prisma.reminder.findFirstOrThrow({
      where: { serviceId: s.id, channel: "email", recipient: "client" },
    })
    expect((await sendReminderEmail(row.id)).ok).toBe(true)
    const mail = devOutbox().at(-1)!
    const inv = await prisma.invoice.findFirstOrThrow({ where: { serviceId: s.id } })
    expect(mail.attachments).toEqual([`Invoice-${inv.number}-d7.pk.pdf`])
    expect(mail.text).toContain(`/i/${inv.publicToken}`)
    expect(inv.status).toBe("sent")
  })
})
