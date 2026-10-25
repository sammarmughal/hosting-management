// docs/14 (integration part), against the hrm_test database: the server
// rules for subscriptions, companies and the Service Catalog, the invoice
// bill-to, who reminders go to, and the CSV import. The actions run for
// real; only the session check and Next's cache are stubbed.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/server/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/session")>()),
  requireAdmin: async () => ({}),
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

import { commitImportAction } from "@/actions/import"
import {
  createCompanyAction,
  deleteCompanyAction,
  updateCompanyAction,
} from "@/actions/companies"
import {
  createServiceTypeAction,
  deleteServiceTypeAction,
  setServiceTypeActiveAction,
} from "@/actions/service-types"
import {
  createSubscriptionAction,
  toggleCancelSubscriptionAction,
  updateSubscriptionAction,
} from "@/actions/subscriptions"
import { addDays } from "@/lib/domain/dates"
import type { SubscriptionInput } from "@/lib/domain/validation"
import { prisma } from "@/lib/server/db"
import { toDbDate } from "@/lib/server/db-dates"
import { getInvoice, listInvoices } from "@/lib/server/invoice-queries"
import { createInvoiceNow, updateFromSubscription } from "@/lib/server/invoices"
import { devOutbox } from "@/lib/server/mail"
import { getCompany, listSubscriptions } from "@/lib/server/queries"
import { runCheck, sendReminderEmail } from "@/lib/server/reminders"
import { updateSettings } from "@/lib/server/settings"
import { SETTING_DEFAULTS } from "@/lib/server/settings-keys"

import { resetDb } from "../helpers/reset-db"
import { serviceTypeId } from "../helpers/subscription-fixtures"

const TODAY = "2026-10-10"
const enabled = !!process.env.TEST_DATABASE_URL

async function reset() {
  await resetDb(prisma, [
    "clients",
    "service_types",
    "settings",
    "message_templates",
    "audit_log",
    "invoice_counters",
  ])
  for (const [key, value] of Object.entries(SETTING_DEFAULTS))
    await prisma.setting.create({ data: { key, value } })
  await updateSettings({
    admin_email: "billing@rehmanweb.pk",
    mail_from_email: "billing@rehmanweb.pk",
  })
  devOutbox().length = 0
  process.env.FAKE_TODAY = TODAY
  process.env.MAIL_TRANSPORT = "json"
}

const newClient = (
  name: string,
  email = `${name.split(" ")[0]!.toLowerCase()}@client.pk`
) =>
  prisma.client.create({ data: { name, email, phone: "923001234567", currency: "PKR" } })

const newCompany = (clientId: number, name: string) =>
  prisma.company.create({
    data: {
      clientId,
      name,
      email: "accounts@company.pk",
      phone: "924235761234",
      address: "Gulberg, Lahore",
    },
  })

/** Redirects mean success (the actions redirect on save). */
async function saved(p: Promise<unknown>) {
  try {
    const res = await p
    return res as { ok: boolean; error?: string; fieldErrors?: Record<string, string> }
  } catch (e) {
    if (String((e as { digest?: string }).digest ?? e).includes("NEXT_REDIRECT"))
      return { ok: true }
    throw e
  }
}

async function input(patch: Partial<SubscriptionInput> = {}): Promise<SubscriptionInput> {
  return {
    clientId: "",
    companyId: "",
    serviceTypeId: await serviceTypeId(prisma),
    domain: "noordental.pk",
    planLabel: "",
    startDate: addDays(TODAY, -345),
    renewalDate: addDays(TODAY, 20),
    chargeAmount: "8750",
    currency: "PKR",
    remindersEnabled: true,
    notes: "",
    ...patch,
  }
}

describe.skipIf(!enabled)("subscriptions: server rules (docs/14 §4)", () => {
  beforeEach(reset)
  afterAll(() => prisma.$disconnect())

  it("saves a subscription under the client's own company", async () => {
    const c = await newClient("Dr Noor")
    const co = await newCompany(c.id, "Noor Dental Clinic")
    expect(
      (
        await saved(
          createSubscriptionAction(await input({ clientId: c.id, companyId: co.id }))
        )
      ).ok
    ).toBe(true)
    const s = await prisma.subscription.findFirstOrThrow()
    expect(s).toMatchObject({ clientId: c.id, companyId: co.id })
  })

  it("refuses another client's company", async () => {
    const a = await newClient("Dr Noor")
    const b = await newClient("Bilal Traders")
    const coB = await newCompany(b.id, "Bilal & Sons")
    const res = await saved(
      createSubscriptionAction(await input({ clientId: a.id, companyId: coB.id }))
    )
    expect(res.ok).toBe(false)
    expect(res.fieldErrors?.companyId).toBe("Choose one of this client's companies")
    expect(await prisma.subscription.count()).toBe(0)
  })

  it("refuses an inactive service, except the subscription's own", async () => {
    const c = await newClient("Dr Noor")
    const amc = await serviceTypeId(prisma, "AMC")
    await prisma.serviceType.update({ where: { id: amc }, data: { isActive: false } })
    const res = await saved(
      createSubscriptionAction(await input({ clientId: c.id, serviceTypeId: amc }))
    )
    expect(res.fieldErrors?.serviceTypeId).toBe(
      "AMC is inactive. Choose an active service."
    )

    // An existing AMC subscription can still be edited after AMC is deactivated.
    const s = await prisma.subscription.create({
      data: {
        clientId: c.id,
        serviceTypeId: amc,
        domain: "Head office",
        startDate: toDbDate("2025-10-01"),
        renewalDate: toDbDate("2026-10-01"),
        chargeAmount: "1000",
      },
    })
    const edit = await saved(
      updateSubscriptionAction(
        s.id,
        await input({
          clientId: c.id,
          serviceTypeId: amc,
          domain: "Head office",
          notes: "Renamed",
        })
      )
    )
    expect(edit.ok).toBe(true)
  })

  it("blocks the same identifier for the same service type, ignoring cancelled ones", async () => {
    const c = await newClient("Dr Noor")
    const hosting = await serviceTypeId(prisma, "Web Hosting")
    const domainReg = await serviceTypeId(prisma, "Domain Registration")
    expect(
      (await saved(createSubscriptionAction(await input({ clientId: c.id })))).ok
    ).toBe(true)

    const dup = await saved(
      createSubscriptionAction(await input({ clientId: c.id, domain: "NoorDental.pk" }))
    )
    expect(dup.fieldErrors?.domain).toBe(
      "noordental.pk already has an active Web Hosting subscription"
    )

    // Another service type for the same domain is fine.
    expect(
      (
        await saved(
          createSubscriptionAction(
            await input({ clientId: c.id, serviceTypeId: domainReg })
          )
        )
      ).ok
    ).toBe(true)

    // Cancel the hosting one: a new one may be added, and the old can't come back.
    const first = await prisma.subscription.findFirstOrThrow({
      where: { serviceTypeId: hosting },
    })
    await toggleCancelSubscriptionAction(first.id)
    expect(
      (await saved(createSubscriptionAction(await input({ clientId: c.id })))).ok
    ).toBe(true)
    const back = await toggleCancelSubscriptionAction(first.id)
    expect(back).toMatchObject({ ok: false })
  })

  it("filters the list by company and service, and searches company names", async () => {
    const c = await newClient("Dr Noor")
    const co = await newCompany(c.id, "Noor Dental Clinic")
    await saved(
      createSubscriptionAction(await input({ clientId: c.id, companyId: co.id }))
    )
    await saved(
      createSubscriptionAction(await input({ clientId: c.id, domain: "drnoor.pk" }))
    )
    expect(
      (await listSubscriptions({ company: co.id })).rows.map((r) => r.domain)
    ).toEqual(["noordental.pk"])
    expect((await listSubscriptions({ q: "Dental Clinic" })).total).toBe(1)
    expect(
      (await listSubscriptions({ service: await serviceTypeId(prisma, "AMC") })).total
    ).toBe(0)
    const row = (await listSubscriptions({ q: "noordental" })).rows[0]
    expect(row).toMatchObject({
      company: "Noor Dental Clinic",
      serviceName: "Web Hosting",
    })
  })
})

describe.skipIf(!enabled)("companies and the Service Catalog (docs/14 §2–§3)", () => {
  beforeEach(reset)

  it("creates companies with unique names per client, and keeps them with their client", async () => {
    const c = await newClient("Dr Noor")
    const other = await newClient("Bilal Traders")
    const data = {
      clientId: c.id,
      name: "Noor Dental Clinic",
      email: "",
      phone: "",
      address: "",
    }
    expect((await saved(createCompanyAction(data))).ok).toBe(true)
    const dup = await saved(createCompanyAction({ ...data, name: "noor dental clinic" }))
    expect(dup.fieldErrors?.name).toBe("This client already has a company with this name")
    // Same name under another client is fine.
    expect(
      await saved(createCompanyAction({ ...data, clientId: other.id }))
    ).toMatchObject({ ok: true })

    const co = await prisma.company.findFirstOrThrow({ where: { clientId: c.id } })
    const move = await saved(updateCompanyAction(co.id, { ...data, clientId: other.id }))
    expect(move.fieldErrors?.clientId).toBe("A company can't move to another client")
  })

  it("deleting a company deletes what the dialog counted", async () => {
    const c = await newClient("Dr Noor")
    const co = await newCompany(c.id, "Noor Dental Clinic")
    await saved(
      createSubscriptionAction(
        await input({ clientId: c.id, companyId: co.id, renewalDate: addDays(TODAY, 5) })
      )
    )
    await saved(
      createSubscriptionAction(await input({ clientId: c.id, domain: "drnoor.pk" }))
    )
    const sub = await prisma.subscription.findFirstOrThrow({
      where: { companyId: co.id },
    })
    await createInvoiceNow(sub.id)
    await prisma.payment.create({
      data: {
        subscriptionId: sub.id,
        amount: "8750",
        paidOn: toDbDate(TODAY),
        periodFrom: toDbDate(TODAY),
        periodTo: toDbDate(addDays(TODAY, 365)),
      },
    })

    expect(await getCompany(co.id)).toMatchObject({
      subscriptions: 1,
      invoices: 1,
      payments: 1,
    })
    expect(await deleteCompanyAction(co.id)).toEqual({ ok: true })
    expect(await prisma.subscription.count()).toBe(1) // the one without a company stays
    expect(await prisma.invoice.count()).toBe(0)
    expect(await prisma.payment.count()).toBe(0)
    expect(await prisma.client.count()).toBe(1) // the client itself stays
  })

  it("a used service type can't be deleted, only deactivated", async () => {
    const c = await newClient("Dr Noor")
    await saved(createSubscriptionAction(await input({ clientId: c.id })))
    const hosting = await serviceTypeId(prisma, "Web Hosting")

    const res = await deleteServiceTypeAction(hosting)
    expect(res).toMatchObject({
      ok: false,
      error: expect.stringContaining("Used by 1 subscription"),
    })
    // The database refuses too (ON DELETE RESTRICT).
    await expect(prisma.serviceType.delete({ where: { id: hosting } })).rejects.toThrow()

    expect(await setServiceTypeActiveAction(hosting, false)).toEqual({ ok: true })
    // An unused type goes.
    expect(
      await createServiceTypeAction({
        name: "Logo Design",
        defaultPrice: "",
        isActive: true,
      })
    ).toEqual({ ok: true })
    const logo = await serviceTypeId(prisma, "Logo Design")
    expect(await deleteServiceTypeAction(logo)).toEqual({ ok: true })
    expect(
      await createServiceTypeAction({
        name: "web hosting",
        defaultPrice: "",
        isActive: true,
      })
    ).toMatchObject({
      ok: false,
      fieldErrors: { name: "A service with this name already exists" },
    })
  })
})

describe.skipIf(!enabled)("invoices and reminders (docs/14 §5–§6)", () => {
  beforeEach(reset)

  it("bills the client with the company under the name, or no company at all", async () => {
    const c = await newClient("Dr Noor")
    const co = await newCompany(c.id, "Noor Dental Clinic")
    await saved(
      createSubscriptionAction(await input({ clientId: c.id, companyId: co.id }))
    )
    await saved(
      createSubscriptionAction(await input({ clientId: c.id, domain: "drnoor.pk" }))
    )
    const [withCo, without] = await prisma.subscription.findMany({
      orderBy: { id: "asc" },
    })

    const a = await createInvoiceNow(withCo!.id)
    const b = await createInvoiceNow(without!.id)
    if ("error" in a || "error" in b) throw new Error("create failed")
    expect((await getInvoice(a.id))?.billTo.company).toEqual({
      name: "Noor Dental Clinic",
      email: "accounts@company.pk",
      phone: "924235761234",
      address: "Gulberg, Lahore",
    })
    expect((await getInvoice(b.id))?.billTo.company).toBeNull()

    // The list shows and filters by the company.
    const list = await listInvoices({
      q: "",
      company: co.id,
      status: "all",
      currency: "",
      from: "",
      to: "",
      page: 1,
    })
    expect(list.rows.map((r) => [r.domain, r.company, r.serviceName])).toEqual([
      ["noordental.pk", "Noor Dental Clinic", "Web Hosting"],
    ])

    // A company added later reaches the open invoice with "Update from subscription".
    await prisma.subscription.update({
      where: { id: without!.id },
      data: { companyId: co.id },
    })
    await updateFromSubscription(b.id)
    expect((await getInvoice(b.id))?.billTo.company?.name).toBe("Noor Dental Clinic")
  })

  it("sends reminders to the client only, naming the company and domain", async () => {
    const c = await newClient("Dr Noor", "noor@client.pk")
    const co = await newCompany(c.id, "Noor Dental Clinic")
    await saved(
      createSubscriptionAction(
        await input({ clientId: c.id, companyId: co.id, renewalDate: addDays(TODAY, 7) })
      )
    )
    await runCheck({ force: true })
    const rows = await prisma.reminder.findMany({ where: { recipient: "client" } })
    expect(rows.map((r) => r.channel).sort()).toEqual(["email", "whatsapp"])

    const email = rows.find((r) => r.channel === "email")!
    expect((await sendReminderEmail(email.id)).ok).toBe(true)
    const sent = devOutbox().filter((m) => m.to !== "billing@rehmanweb.pk")
    expect(sent.map((m) => m.to)).toEqual(["noor@client.pk"])
    expect(JSON.stringify(devOutbox())).not.toContain("accounts@company.pk")
    expect(sent[0]?.subject).toBe(
      "Reminder: Web Hosting for noordental.pk renews on 17 Oct 2026"
    )
    expect(sent[0]?.text).toContain(
      "noordental.pk (Noor Dental Clinic) will expire on 17 Oct 2026"
    )
  })
})

describe.skipIf(!enabled)("CSV import (docs/14 §9)", () => {
  beforeEach(reset)

  it("imports clients, then companies, then subscriptions, and updates only when asked", async () => {
    const clients = await commitImportAction(
      "clients",
      [
        {
          name: "Dr Noor",
          email: "noor@client.pk",
          phone: "0300 1234567",
          currency: "PKR",
        },
        { name: "No Contact" },
      ],
      false
    )
    expect(clients).toEqual({ ok: true, data: { created: 1, updated: 0, skipped: 1 } })

    const companies = await commitImportAction(
      "companies",
      [
        {
          client_name: "Dr Noor",
          client_email: "noor@client.pk",
          company_name: "Noor Dental Clinic",
        },
      ],
      false
    )
    expect(companies.ok && companies.data?.created).toBe(1)

    const row = {
      client_name: "Dr Noor",
      client_email: "noor@client.pk",
      company_name: "Noor Dental Clinic",
      service_type: "Web Hosting",
      domain: "noordental.pk",
      start_date: "30/09/2025",
      renewal_date: "",
      charge_amount: "8,750",
      reminders: "yes",
    }
    expect(await commitImportAction("subscriptions", [row], false)).toEqual({
      ok: true,
      data: { created: 1, updated: 0, skipped: 0 },
    })
    const s = await prisma.subscription.findFirstOrThrow({
      include: { company: true, serviceType: true },
    })
    expect(s.company?.name).toBe("Noor Dental Clinic")
    expect(s.serviceType.name).toBe("Web Hosting")
    expect(s.chargeAmount.toFixed(0)).toBe("8750")

    // The same row again: skipped, or updated when asked.
    const again = await commitImportAction(
      "subscriptions",
      [{ ...row, charge_amount: "9000" }],
      false
    )
    expect(again.ok && again.data?.skipped).toBe(1)
    const update = await commitImportAction(
      "subscriptions",
      [{ ...row, charge_amount: "9000" }],
      true
    )
    expect(update.ok && update.data?.updated).toBe(1)
    expect((await prisma.subscription.findFirstOrThrow()).chargeAmount.toFixed(0)).toBe(
      "9000"
    )
    expect(await prisma.subscription.count()).toBe(1)
  })

  it("refuses more than 2,000 rows", async () => {
    const rows = Array.from({ length: 2001 }, () => ({ name: "x" }))
    expect(await commitImportAction("clients", rows, false)).toMatchObject({ ok: false })
  })
})
