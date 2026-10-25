import { describe, expect, it } from "vitest"

import {
  emptyImportContext,
  IMPORT_HEADERS,
  matchClient,
  previewClients,
  previewCompanies,
  previewImport,
  previewSubscriptions,
  REQUIRED_HEADERS,
  type ImportContext,
} from "@/lib/domain/import"
import { reminderSettingsSchema, INITIAL_PREFERENCES } from "@/lib/domain/preferences"

// docs/14 §9: three files, each matched against what the database holds.
const ctx: ImportContext = {
  ...emptyImportContext("2026-10-02"),
  currencies: { default: "PKR", enabled: ["AED", "PKR", "USD"] },
  clients: [
    {
      id: 1,
      name: "Faisal Ahmed",
      email: "faisal@faisalprint.pk",
      phone: null,
      currency: "PKR",
    },
    { id: 2, name: "Imran Qureshi", email: null, phone: "923452233445", currency: "AED" },
  ],
  companies: [{ id: 10, clientId: 1, name: "Faisal Printers" }],
  serviceTypes: [
    { id: 1, name: "Domain Registration", isActive: true },
    { id: 2, name: "Web Hosting", isActive: true },
    { id: 5, name: "AMC", isActive: false },
  ],
  subscriptions: [{ id: 50, serviceTypeId: 2, domain: "existing.pk" }],
}

describe("import headers", () => {
  it("lists the template columns of each file, required ones included", () => {
    expect(IMPORT_HEADERS.clients).toEqual([
      "name",
      "email",
      "phone",
      "address",
      "currency",
      "notes",
    ])
    for (const kind of ["clients", "companies", "subscriptions"] as const)
      for (const h of REQUIRED_HEADERS[kind]) expect(IMPORT_HEADERS[kind]).toContain(h)
  })
})

describe("matchClient", () => {
  it("needs the same name (any case) and the same email or phone", () => {
    expect(
      matchClient(ctx.clients, "faisal ahmed", "FAISAL@faisalprint.pk", "")?.id
    ).toBe(1)
    expect(matchClient(ctx.clients, "Imran Qureshi", "", "0345 2233445")?.id).toBe(2)
    expect(matchClient(ctx.clients, "Faisal Ahmed", "other@x.pk", "")).toBeNull()
    expect(
      matchClient(ctx.clients, "Someone Else", "faisal@faisalprint.pk", "")
    ).toBeNull()
  })
})

describe("clients.csv", () => {
  it("validates new clients and warns about existing ones", () => {
    const rows = previewClients(
      [
        { name: "Sana Javed", email: "sana@x.pk", phone: "", currency: "" },
        { name: "Faisal Ahmed", email: "faisal@faisalprint.pk" },
      ],
      ctx
    )
    expect(rows.map((r) => r.status)).toEqual(["valid", "warning"])
    expect(rows[0]?.data).toMatchObject({
      name: "Sana Javed",
      currency: "PKR",
      phone: null,
    })
    expect(rows[1]?.existingId).toBe(1)
  })

  it("errors on the same client twice, and on no contact at all", () => {
    const rows = previewClients(
      [
        { name: "Sana Javed", email: "sana@x.pk" },
        { name: "sana javed", email: "SANA@x.pk" },
        { name: "No Contact" },
      ],
      ctx
    )
    expect(rows.map((r) => r.status)).toEqual(["valid", "error", "error"])
    expect(rows[2]?.data).toBeNull()
  })
})

describe("companies.csv", () => {
  const row = { client_name: "Faisal Ahmed", client_email: "faisal@faisalprint.pk" }

  it("attaches a company to an existing client", () => {
    const [r] = previewCompanies(
      [{ ...row, company_name: "Faisal Digital", phone: "0300 1234567" }],
      ctx
    )
    expect(r?.status).toBe("valid")
    expect(r?.data).toEqual({
      clientId: 1,
      name: "Faisal Digital",
      email: null,
      phone: "923001234567",
      address: null,
    })
  })

  it("warns about an existing company and errors on an unknown client", () => {
    const rows = previewCompanies(
      [
        { ...row, company_name: "faisal printers" },
        { client_name: "Nobody", client_email: "no@x.pk", company_name: "Ghost Ltd" },
      ],
      ctx
    )
    expect(rows.map((r) => r.status)).toEqual(["warning", "error"])
    expect(rows[0]?.existingId).toBe(10)
    expect(rows[1]?.message).toContain("Import clients first")
  })
})

describe("subscriptions.csv", () => {
  const row = {
    client_name: "Faisal Ahmed",
    client_email: "faisal@faisalprint.pk",
    company_name: "Faisal Printers",
    service_type: "web hosting",
    domain: "https://www.FaisalPrint.pk/",
    start_date: "30/09/2025",
    renewal_date: "30/09/2026",
    charge_amount: "6,500",
    currency: "",
    reminders: "",
  }

  it("resolves client, company and service type, and reads day-first dates", () => {
    const [r] = previewSubscriptions([row], ctx)
    expect(r?.status).toBe("valid")
    expect(r?.data).toMatchObject({
      clientId: 1,
      companyId: 10,
      serviceTypeId: 2,
      domain: "faisalprint.pk",
      startDate: "2025-09-30",
      renewalDate: "2026-09-30",
      chargeAmount: "6500",
      currency: "PKR",
      remindersEnabled: true,
    })
    expect(r?.cells).toEqual([
      "faisalprint.pk",
      "Faisal Ahmed · Faisal Printers",
      "2026-09-30",
    ])
  })

  it("allows no company, and reminders off", () => {
    const [r] = previewSubscriptions([{ ...row, company_name: "", reminders: "no" }], ctx)
    expect(r?.data).toMatchObject({ companyId: null, remindersEnabled: false })
  })

  it("fills an omitted renewal date and warns without blocking", () => {
    const [r] = previewSubscriptions([{ ...row, renewal_date: "" }], ctx)
    expect(r?.data?.renewalDate).toBe("2026-09-30")
    expect(r?.status).toBe("warning")
  })

  it("errors on another client's company, an unknown or inactive service, and bad reminders", () => {
    const rows = previewSubscriptions(
      [
        {
          ...row,
          client_name: "Imran Qureshi",
          client_email: "",
          client_phone: "03452233445",
        },
        { ...row, service_type: "Logo Design" },
        { ...row, service_type: "AMC" },
        { ...row, reminders: "maybe" },
      ],
      ctx
    )
    expect(rows.map((r) => r.status)).toEqual(["error", "error", "error", "error"])
    expect(rows[0]?.message).toContain("isn’t a company of this client")
    expect(rows[1]?.message).toContain("Unknown service: Logo Design")
    expect(rows[2]?.message).toContain("AMC is inactive")
    expect(rows[3]?.message).toContain("Reminders must be yes or no")
  })

  it("matches existing subscriptions by service type + identifier, and duplicates in the file", () => {
    const rows = previewSubscriptions(
      [
        { ...row, domain: "existing.pk" },
        { ...row, domain: "existing.pk", service_type: "Domain Registration" },
        { ...row, domain: "existing.pk", service_type: "Domain Registration" },
      ],
      ctx
    )
    expect(rows.map((r) => r.status)).toEqual(["warning", "valid", "error"])
    expect(rows[0]?.existingId).toBe(50)
  })

  it("accepts identifiers that aren't domains", () => {
    const [r] = previewSubscriptions(
      [{ ...row, service_type: "Domain Registration", domain: "Head office support" }],
      ctx
    )
    expect(r?.data?.domain).toBe("Head office support")
  })

  it("rejects invalid dates, money and unknown clients", () => {
    for (const patch of [
      { start_date: "2025-02-30" },
      { charge_amount: "hello" },
      { client_email: "someone@else.pk" },
    ])
      expect(previewImport("subscriptions", [{ ...row, ...patch }], ctx)[0]?.status).toBe(
        "error"
      )
  })
})

describe("reminder settings validation", () => {
  it("requires ordered thresholds, unique bounded stages and a pre-expiry stage", () => {
    const valid = INITIAL_PREFERENCES.reminders
    expect(reminderSettingsSchema.safeParse(valid).success).toBe(true)
    for (const patch of [
      { red: 40 },
      { stages: [-3] },
      { stages: [7, 7] },
      { stages: [91] },
    ])
      expect(reminderSettingsSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
})
