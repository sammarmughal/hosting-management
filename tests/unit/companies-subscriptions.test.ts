// docs/14 (unit part): billing cycles, the Service Catalog, companies, the
// invoice line and bill-to, the nav and the CSV export columns.
import { describe, expect, it } from "vitest"

import { fabFor, NAV_ITEMS } from "@/components/layout/nav"
import {
  companyDeleteText,
  companyLine,
  companyOptionLabel,
} from "@/lib/domain/companies"
import { nextRenewal } from "@/lib/domain/cycles"
import { cyclePeriod, itemDescription, readBillTo } from "@/lib/domain/invoices"
import { IMPORT_HEADERS } from "@/lib/domain/import"
import {
  canDeleteServiceType,
  DEFAULT_SERVICE_TYPES,
  sameServiceName,
  serviceTypeDeleteBlock,
} from "@/lib/domain/service-types"
import {
  CLIENT_COLUMNS,
  COMPANY_COLUMNS,
  PAYMENT_COLUMNS,
  SUBSCRIPTION_COLUMNS,
} from "@/lib/export-columns"

describe("billing cycle (docs/14 §1)", () => {
  it("is yearly, and handles 29 February", () => {
    expect(nextRenewal("2026-09-30")).toBe("2027-09-30")
    expect(nextRenewal("2028-02-29", "yearly")).toBe("2029-02-28")
  })

  it("drives the invoice period", () => {
    expect(cyclePeriod("2026-10-27")).toEqual({
      periodStart: "2026-10-27",
      periodEnd: "2027-10-27",
      dueDate: "2026-10-27",
    })
  })
})

describe("Service Catalog (docs/14 §2)", () => {
  it("starts with the five defaults", () => {
    expect(DEFAULT_SERVICE_TYPES).toEqual([
      "Domain Registration",
      "Web Hosting",
      "Domain and Hosting",
      "Website Maintenance",
      "AMC",
    ])
  })

  it("deletes only unused types, and says why otherwise", () => {
    expect(canDeleteServiceType(0)).toBe(true)
    expect(serviceTypeDeleteBlock(0)).toBeNull()
    expect(canDeleteServiceType(3)).toBe(false)
    expect(serviceTypeDeleteBlock(1)).toBe(
      "Used by 1 subscription, so it can't be deleted. Deactivate it to hide it from new subscriptions."
    )
    expect(serviceTypeDeleteBlock(3)).toContain("Used by 3 subscriptions")
  })

  it("compares names ignoring case and spaces", () => {
    expect(sameServiceName(" web hosting ", "Web Hosting")).toBe(true)
    expect(sameServiceName("AMC", "AMC 2")).toBe(false)
  })
})

describe("companies (docs/14 §3)", () => {
  it("says what deleting a company takes with it", () => {
    expect(companyDeleteText({ subscriptions: 2, invoices: 3, payments: 1 })).toBe(
      "This deletes 2 subscriptions, 3 invoices, 1 payment and their reminders. This can't be undone."
    )
    expect(companyDeleteText({ subscriptions: 1, invoices: 0, payments: 0 })).toBe(
      "This deletes 1 subscription and their reminders. This can't be undone."
    )
    expect(companyDeleteText({ subscriptions: 0, invoices: 0, payments: 0 })).toBe(
      "This deletes the company. This can't be undone."
    )
  })

  it("formats the company after a domain, and in pickers", () => {
    expect(companyLine("Noor Dental Clinic")).toBe(" (Noor Dental Clinic)")
    expect(companyLine(null)).toBe("")
    expect(companyOptionLabel("Noor Dental Clinic", "Dr Noor")).toBe(
      "Noor Dental Clinic — Dr Noor"
    )
  })
})

describe("invoices (docs/14 §5)", () => {
  it("names the service type, the identifier and the plan on the line", () => {
    expect(itemDescription("Web Hosting", "noordental.pk", "Business")).toBe(
      "Web Hosting — noordental.pk, Business plan"
    )
    expect(itemDescription("AMC", "Head office")).toBe("AMC — Head office")
  })

  it("reads bill-to snapshots with a company, without one, and the old string form", () => {
    const company = {
      name: "Noor Dental Clinic",
      email: "info@noor.pk",
      phone: null,
      address: "Lahore",
    }
    expect(
      readBillTo({
        name: "Dr Noor",
        company,
        email: null,
        phone: "923001234567",
        address: null,
      })
    ).toEqual({
      name: "Dr Noor",
      company,
      email: null,
      phone: "923001234567",
      address: null,
    })
    expect(readBillTo({ name: "Ali", company: null }).company).toBeNull()
    expect(readBillTo({ name: "Ali", company: "Old Co" }).company).toEqual({
      name: "Old Co",
      email: null,
      phone: null,
      address: null,
    })
    expect(readBillTo({ name: "Ali", company: "" }).company).toBeNull()
    expect(readBillTo(null)).toMatchObject({ name: "", company: null })
  })
})

describe("navigation (docs/14 §0, §7)", () => {
  it("lists the pages in the client's order", () => {
    expect(NAV_ITEMS.map((i) => i.label)).toEqual([
      "Dashboard",
      "Clients",
      "Companies",
      "Service Catalog",
      "Subscriptions",
      "Reminders",
      "Invoices",
      "Payments",
      "Import",
      "Settings",
    ])
  })

  it("puts the right Add button on each list", () => {
    expect(fabFor("/clients")?.href).toBe("/clients/new")
    expect(fabFor("/companies")?.href).toBe("/companies/new")
    expect(fabFor("/dashboard")?.href).toBe("/subscriptions/new")
    expect(fabFor("/subscriptions")?.href).toBe("/subscriptions/new")
    expect(fabFor("/settings")).toBeNull()
  })
})

describe("CSV export columns (docs/14 §9)", () => {
  const headers = (cols: { header: string }[], n = cols.length) =>
    cols.slice(0, n).map((c) => c.header)

  it("start with the import columns, so an export imports back", () => {
    expect(headers(CLIENT_COLUMNS, IMPORT_HEADERS.clients.length)).toEqual(
      IMPORT_HEADERS.clients
    )
    expect(headers(COMPANY_COLUMNS)).toEqual(IMPORT_HEADERS.companies)
    expect(headers(SUBSCRIPTION_COLUMNS, IMPORT_HEADERS.subscriptions.length)).toEqual(
      IMPORT_HEADERS.subscriptions
    )
    expect(headers(SUBSCRIPTION_COLUMNS).slice(-2)).toEqual(["status", "days_left"])
  })

  it("include the company in payments", () => {
    expect(headers(PAYMENT_COLUMNS)).toContain("company")
  })
})
