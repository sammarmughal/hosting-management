import { describe, expect, it } from "vitest"

import {
  daysText,
  pickSection,
  renderForDays,
  renderTemplate,
} from "@/lib/domain/templates"

const SUBJECT = [
  "[[before]]Reminder: {domain} hosting renews on {renewal_date}",
  "[[today]]Today: {domain} hosting expires today",
  "[[after]]Action needed: {domain} hosting expired on {renewal_date}",
].join("\n")

describe("pickSection", () => {
  it("picks [[before]] when days > 0", () => {
    expect(pickSection(SUBJECT, 7)).toBe(
      "Reminder: {domain} hosting renews on {renewal_date}"
    )
  })
  it("picks [[today]] when days = 0", () => {
    expect(pickSection(SUBJECT, 0)).toBe("Today: {domain} hosting expires today")
  })
  it("picks [[after]] when days < 0", () => {
    expect(pickSection(SUBJECT, -3)).toBe(
      "Action needed: {domain} hosting expired on {renewal_date}"
    )
  })
  it("uses a template without markers as-is for every case", () => {
    const t = "Hello {client_name}"
    expect(pickSection(t, 5)).toBe(t)
    expect(pickSection(t, 0)).toBe(t)
    expect(pickSection(t, -5)).toBe(t)
  })
  it("trims multi-line sections", () => {
    const body =
      "[[before]]\n<p>Before</p>\n[[today]]\n<p>Today</p>\n[[after]]\n<p>After</p>\n"
    expect(pickSection(body, 0)).toBe("<p>Today</p>")
  })
  it("falls back to the first section when one is missing", () => {
    expect(pickSection("[[before]]Soon[[after]]Late", 0)).toBe("Soon")
  })
})

describe("daysText", () => {
  it.each([
    [1, "in 1 day"],
    [7, "in 7 days"],
    [0, "today"],
    [-1, "1 day ago"],
    [-3, "3 days ago"],
  ])("%i → %s", (d, expected) => {
    expect(daysText(d)).toBe(expected)
  })
})

describe("renderTemplate", () => {
  it("escapes values in HTML mode", () => {
    const out = renderTemplate(
      "<p>Dear {client_name},</p>",
      { client_name: "<b>Ali</b> & Co" },
      { mode: "html" }
    )
    expect(out).toBe("<p>Dear &lt;b&gt;Ali&lt;/b&gt; &amp; Co,</p>")
  })
  it("does not escape in text mode", () => {
    const out = renderTemplate(
      "Dear {client_name}",
      { client_name: "<b>Ali</b>" },
      { mode: "text" }
    )
    expect(out).toBe("Dear <b>Ali</b>")
  })
  it("leaves {summary_table} unescaped in HTML mode", () => {
    const out = renderTemplate(
      "{summary_table}",
      { summary_table: "<table></table>" },
      { mode: "html" }
    )
    expect(out).toBe("<table></table>")
  })
  it("leaves unknown placeholders unchanged", () => {
    expect(
      renderTemplate("Hi {foo} {domain}", { domain: "noordental.pk" }, { mode: "text" })
    ).toBe("Hi {foo} noordental.pk")
  })
  it("renders null values as empty strings", () => {
    expect(renderTemplate("[{company}]", { company: null }, { mode: "text" })).toBe("[]")
  })
  it("renders numbers", () => {
    expect(renderTemplate("{days_left} days", { days_left: 7 }, { mode: "text" })).toBe(
      "7 days"
    )
  })
  it("does not treat inherited keys as placeholders", () => {
    expect(renderTemplate("{constructor}", {}, { mode: "text" })).toBe("{constructor}")
  })
})

describe("renderForDays", () => {
  it("picks the section, then renders it", () => {
    const out = renderForDays(
      SUBJECT,
      -4,
      { domain: "bilaltraders.com", renewal_date: "24 Sep 2026" },
      { mode: "text" }
    )
    expect(out).toBe("Action needed: bilaltraders.com hosting expired on 24 Sep 2026")
  })
})
