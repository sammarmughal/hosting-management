import { describe, expect, it } from "vitest"

import { DEFAULT_TEMPLATES, SUBJECT_MAX } from "@/lib/domain/default-templates"
import {
  adminEmail,
  adminWhatsappText,
  clientEmail,
  clientVars,
  clientWhatsappText,
  htmlToText,
  invoiceWhatsappText,
  summaryList,
  type MessageSubscription,
} from "@/lib/domain/messages"
import { renderTemplate } from "@/lib/domain/templates"

const TODAY = "2026-10-10"
const business = { businessName: "Rehman Web Services", businessPhone: "+92 300 1112233" }
const base: MessageSubscription = {
  domain: "noordental.pk",
  serviceName: "Web Hosting",
  clientName: "Dr Noor",
  phone: "923214455667",
  renewalDate: "2026-10-27",
  daysLeft: 17,
  chargeAmount: "8750.00",
  currency: "PKR",
  colour: "orange",
}
const withCompany: MessageSubscription = { ...base, company: "Noor Dental Clinic" }

describe("client messages (docs/08 §2–§3, docs/14 §6)", () => {
  it("renders the before/today/after WhatsApp sections with formatted values", () => {
    const before = clientWhatsappText(
      DEFAULT_TEMPLATES.client_whatsapp,
      base,
      business,
      TODAY
    )
    expect(before).toContain(
      "your Web Hosting for *noordental.pk* will expire on *27 Oct 2026* (in 17 days)"
    )
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

  it("names the company after the domain when there is one", () => {
    const wa = clientWhatsappText(
      DEFAULT_TEMPLATES.client_whatsapp,
      withCompany,
      business,
      TODAY
    )
    expect(wa).toContain("*noordental.pk* (Noor Dental Clinic) will expire")
    const mail = clientEmail(DEFAULT_TEMPLATES.client_email, withCompany, business, TODAY)
    expect(mail.text).toContain(
      "noordental.pk (Noor Dental Clinic) will expire on 27 Oct 2026"
    )
  })

  it("offers {{company_name}}, {{company_line}}, {{service_name}} and the old {company}", () => {
    const vars = clientVars(withCompany, business, TODAY)
    const render = (t: string) => renderTemplate(t, vars, { mode: "text" })
    expect(render("{{service_name}} · {{company_name}} · {company}")).toBe(
      "Web Hosting · Noor Dental Clinic · Noor Dental Clinic"
    )
    expect(render("{domain}{{company_line}}")).toBe("noordental.pk (Noor Dental Clinic)")
    // No company: the placeholders are empty, not left as text.
    const none = clientVars(base, business, TODAY)
    expect(
      renderTemplate("[{{company_name}}][{{company_line}}]", none, { mode: "text" })
    ).toBe("[][]")
  })

  it("escapes client data in the HTML email, picks the subject line, adds a text part", () => {
    const evil = {
      ...base,
      clientName: "<img src=x onerror=alert(1)>",
      company: "<b>Co</b>",
    }
    const m = clientEmail(DEFAULT_TEMPLATES.client_email, evil, business, TODAY)
    expect(m.subject).toBe(
      "Reminder: Web Hosting for noordental.pk renews on 27 Oct 2026"
    )
    expect(m.html).not.toContain("<img src=x")
    expect(m.html).toContain("&lt;img src=x onerror=alert(1)&gt;")
    expect(m.html).toContain("(&lt;b&gt;Co&lt;/b&gt;)")
    expect(m.html).toContain("This is an automated reminder from Rehman Web Services")
    expect(m.text).toContain("Dear <img src=x onerror=alert(1)>,")
    expect(m.text).not.toMatch(/<\/?(p|br)\b/)
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

  it("puts the service and company in the invoice WhatsApp text", () => {
    const text = invoiceWhatsappText(
      DEFAULT_TEMPLATES.invoice_whatsapp,
      withCompany,
      business,
      TODAY,
      {
        number: "INV-2026-0012",
        link: "https://renewals.example/i/abc",
        total: "8750.000",
        currency: "PKR",
        dueDate: "2026-10-27",
      }
    )
    expect(text).toContain(
      "Your invoice *INV-2026-0012* for Web Hosting – *noordental.pk* (Noor Dental Clinic) is ready."
    )
  })
})

describe("admin summary (docs/08 §5, docs/14 §6)", () => {
  const subs: MessageSubscription[] = [
    withCompany,
    {
      ...base,
      domain: "bilaltraders.com",
      clientName: "Bilal Traders",
      daysLeft: -4,
      colour: "expired",
      chargeAmount: "4500.00",
    },
    {
      ...base,
      domain: "ayeshacouture.pk",
      clientName: "Ayesha",
      company: "Ayesha Couture",
      daysLeft: 2,
      colour: "red",
      chargeAmount: "6500.50",
    },
    {
      ...base,
      domain: "almadinaexports.com",
      serviceName: "Domain Registration",
      clientName: "Al-Madina",
      daysLeft: 30,
      chargeAmount: "65.00",
      currency: "USD",
    },
  ]

  it("lists most urgent first with status words, service and company", () => {
    expect(summaryList(subs).split("\n")).toEqual([
      "Expired: bilaltraders.com (Web Hosting) – Bilal Traders – expired 4 days ago – PKR 4,500",
      "Urgent: ayeshacouture.pk (Web Hosting) – Ayesha (Ayesha Couture) – 2 days – PKR 6,500.50",
      "Expiring: noordental.pk (Web Hosting) – Dr Noor (Noor Dental Clinic) – 17 days – PKR 8,750",
      "Expiring: almadinaexports.com (Domain Registration) – Al-Madina – 30 days – USD 65",
    ])
  })

  it("has a total expected row per currency, never mixing currencies", () => {
    const m = adminEmail(DEFAULT_TEMPLATES.admin_email, subs, business, TODAY)
    expect(m.subject).toBe("4 renewals need attention – 10 Oct 2026")
    expect(m.html).toContain("Total expected (PKR)")
    expect(m.html).toContain("PKR 19,750.50")
    expect(m.html).toContain("Total expected (USD)")
    expect(m.html).toContain("USD 65")
    expect(m.html).toContain("Noor Dental Clinic")
    expect(m.text).toContain("Urgent: ayeshacouture.pk")
  })

  it("renders the WhatsApp summary for the admin's own number", () => {
    const text = adminWhatsappText(
      DEFAULT_TEMPLATES.admin_whatsapp,
      subs,
      business,
      TODAY
    )
    expect(text).toContain("*Renewals – 10 Oct 2026*")
    expect(text).toContain("4 subscriptions need attention:")
  })
})

describe("default templates", () => {
  it("fit the subject column (VARCHAR 190), all sections together", () => {
    for (const t of Object.values(DEFAULT_TEMPLATES))
      expect((t.subject ?? "").length).toBeLessThanOrEqual(SUBJECT_MAX)
  })

  it("no longer say hosting (docs/14 §6)", () => {
    for (const t of Object.values(DEFAULT_TEMPLATES))
      expect(`${t.subject ?? ""} ${t.body}`.toLowerCase()).not.toContain("hosting")
  })
})

describe("htmlToText", () => {
  it("keeps paragraphs and line breaks and decodes entities", () => {
    expect(htmlToText("<p>Hi &amp; bye</p><p>Line<br>two</p>")).toBe(
      "Hi & bye\n\nLine\ntwo"
    )
  })
})
