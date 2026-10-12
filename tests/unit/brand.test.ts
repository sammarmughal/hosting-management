import { describe, expect, it } from "vitest"

import { brandInitials, parseLogoDataUrl } from "@/lib/domain/brand"
import { emailWordmark, wrapEmail } from "@/lib/domain/messages"
import { businessSchema, INITIAL_PREFERENCES } from "@/lib/domain/preferences"

describe("brandInitials (sidebar mark without a logo)", () => {
  it.each([
    ["Abdul Rehmaan", "AR"],
    ["abdul rehmaan", "AR"],
    ["Rehman Web Services", "RW"],
    ["Sheikh & Sons (Pvt) Ltd", "SS"],
    ["  Renewals  ", "RE"],
    ["A", "A"],
    ["123 Hosting", "HO"],
    ["", ""],
    ["— 42 —", ""],
  ])("%j → %j", (name, initials) => {
    expect(brandInitials(name)).toBe(initials)
  })
})

describe("parseLogoDataUrl", () => {
  it("accepts PNG and JPEG data URLs only", () => {
    expect(parseLogoDataUrl("data:image/png;base64,iVBORw0KGgo=")).toEqual({
      type: "image/png",
      base64: "iVBORw0KGgo=",
    })
    expect(parseLogoDataUrl("data:image/jpeg;base64,/9j/4AAQ")?.type).toBe("image/jpeg")
    expect(parseLogoDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull()
    expect(parseLogoDataUrl("")).toBeNull()
  })
})

describe("email wordmark (no logo)", () => {
  it("shows the business name as a 19px semibold ink wordmark", () => {
    const html = emailWordmark({ businessName: "Abdul Rehmaan" })
    expect(html).toContain(">Abdul Rehmaan</div>")
    expect(html).toMatch(/font-size:19px;[^"]*font-weight:600;[^"]*color:#111827/)
    expect(html).toContain("Geist,")
    // No tagline line, no image.
    expect(html.match(/<div/g)).toHaveLength(1)
    expect(html).not.toContain("<img")
  })
  it("adds the tagline below in muted text only when set", () => {
    const html = emailWordmark({
      businessName: "Abdul Rehmaan",
      businessTagline: "Senior UI/UX & Product Designer",
    })
    expect(html).toContain('color:#6b7280">Senior UI/UX &amp; Product Designer</div>')
    expect(emailWordmark({ businessName: "X", businessTagline: "   " })).not.toContain(
      "#6b7280"
    )
  })
  it("escapes the name and tagline and keeps them on one line", () => {
    const html = emailWordmark({
      businessName: "<b>A\nR</b>",
      businessTagline: "x<script>",
    })
    expect(html).toContain("&lt;b&gt;A R&lt;/b&gt;")
    expect(html).not.toContain("<script>")
  })
  it("is the header of every wrapped email", () => {
    const html = wrapEmail("<p>Hi</p>", {
      businessName: "Abdul Rehmaan",
      businessTagline: "Designer",
    })
    expect(html).toContain(
      emailWordmark({ businessName: "Abdul Rehmaan", businessTagline: "Designer" })
    )
    expect(html).toContain("This is an automated reminder from Abdul Rehmaan")
  })
})

describe("Settings → Business: tagline", () => {
  const base = INITIAL_PREFERENCES.business
  it("is optional and trimmed", () => {
    expect(businessSchema.parse({ ...base, tagline: "" }).tagline).toBe("")
    expect(
      businessSchema.parse({ ...base, tagline: "  Senior UI/UX & Product Designer " })
        .tagline
    ).toBe("Senior UI/UX & Product Designer")
  })
  it("is capped at 100 characters", () => {
    expect(businessSchema.safeParse({ ...base, tagline: "x".repeat(101) }).success).toBe(
      false
    )
  })
})
