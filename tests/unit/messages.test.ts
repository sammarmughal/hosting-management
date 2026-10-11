import { describe, expect, it } from "vitest"

import { DEFAULT_TEMPLATES } from "@/lib/domain/default-templates"
import {
  adminEmail,
  adminWhatsappText,
  clientEmail,
  clientWhatsappText,
  htmlToText,
  summaryList,
  type MessageService,
} from "@/lib/domain/messages"

const TODAY = "2026-10-10"
const business = { businessName: "Rehman Web Services", businessPhone: "+92 300 1112233" }
const base: MessageService = {
  domain: "noordental.pk",
  clientName: "Noor Dental Clinic",
  phone: "923214455667",
  renewalDate: "2026-10-27",
  daysLeft: 17,
  chargeAmount: "8750.00",
  currency: "PKR",
  colour: "orange",
}

describe("client messages (docs/08 §2–§3)", () => {
  it("renders the before/today/after WhatsApp sections with formatted values", () => {
    const before = clientWhatsappText(DEFAULT_TEMPLATES.client_whatsapp, base, business, TODAY)
    expect(before).toContain("*noordental.pk* will expire on *27 Oct 2026* (in 17 days)")
    expect(before).toContain("Renewal charge: *PKR 8,750*")
    const today = clientWhatsappText(
      DEFAULT_TEMPLATES.client_whatsapp,
      { ...base, daysLeft: 0 },
      business,
      TODAY
    )
    expect(today).toContain("*expires today*")
    const after = clientWhatsappText(
      DEFAULT_TEMPLATES.client_whatsapp,
      { ...base, daysLeft: -3 },
      business,
      TODAY
    )
    expect(after).toContain("(3 days ago)")
  })

  it("escapes client data in the HTML email, picks the subject line, adds a text part", () => {
    const evil = { ...base, clientName: "<img src=x onerror=alert(1)>" }
    const m = clientEmail(DEFAULT_TEMPLATES.client_email, evil, business, TODAY)
    expect(m.subject).toBe("Reminder: noordental.pk hosting renews on 27 Oct 2026")
    expect(m.html).not.toContain("<img src=x")
    expect(m.html).toContain("&lt;img src=x onerror=alert(1)&gt;")
    expect(m.html).toContain("This is an automated reminder from Rehman Web Services")
    expect(m.text).toContain("Dear <img src=x onerror=alert(1)>,")
    expect(m.text).not.toMatch(/<\/?(p|b|br)\b/)
  })

  it("keeps subjects on one line", () => {
    const m = clientEmail(
      { subject: "Hi {client_name}", body: "x" },
      { ...base, clientName: "A\r\nBcc: someone@evil.pk" },
      business,
      TODAY
    )
    expect(m.subject).toBe("Hi A Bcc: someone@evil.pk")
  })
})

describe("admin summary (docs/08 §5)", () => {
  const services: MessageService[] = [
    base,
    { ...base, domain: "bilaltraders.com", clientName: "Bilal Traders", daysLeft: -4, colour: "expired", chargeAmount: "4500.00" },
    { ...base, domain: "ayeshacouture.pk", clientName: "Ayesha", daysLeft: 2, colour: "red", chargeAmount: "6500.50" },
    { ...base, domain: "almadinaexports.com", clientName: "Al-Madina", daysLeft: 30, chargeAmount: "65.00", currency: "USD" },
  ]

  it("lists most urgent first with status words, no emoji (docs/12 §6)", () => {
    expect(summaryList(services).split("\n")).toEqual([
      "Expired: bilaltraders.com – Bilal Traders – expired 4 days ago – PKR 4,500",
      "Urgent: ayeshacouture.pk – Ayesha – 2 days – PKR 6,500.50",
      "Expiring: noordental.pk – Noor Dental Clinic – 17 days – PKR 8,750",
      "Expiring: almadinaexports.com – Al-Madina – 30 days – USD 65",
    ])
  })

  it("has a total expected row per currency, never mixing currencies", () => {
    const m = adminEmail(DEFAULT_TEMPLATES.admin_email, services, business, TODAY)
    expect(m.subject).toBe("4 hosting renewals need attention – 10 Oct 2026")
    expect(m.html).toContain("Total expected (PKR)")
    expect(m.html).toContain("PKR 19,750.50")
    expect(m.html).toContain("Total expected (USD)")
    expect(m.html).toContain("USD 65")
    expect(m.text).toContain("Urgent: ayeshacouture.pk")
  })

  it("renders the WhatsApp summary for the admin's own number", () => {
    const text = adminWhatsappText(DEFAULT_TEMPLATES.admin_whatsapp, services, business, TODAY)
    expect(text).toContain("*Hosting renewals – 10 Oct 2026*")
    expect(text).toContain("4 services need attention:")
  })
})

describe("htmlToText", () => {
  it("keeps paragraphs and line breaks and decodes entities", () => {
    expect(htmlToText("<p>Hi &amp; bye</p><p>Line<br>two</p>")).toBe("Hi & bye\n\nLine\ntwo")
  })
})
