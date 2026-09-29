import { describe, expect, it } from "vitest"

import { clientsHref, DEFAULT_PARAMS, parseClientsParams } from "@/lib/service-filters"

describe("parseClientsParams", () => {
  it("reads valid values", () => {
    expect(
      parseClientsParams({
        q: " bilal ",
        filter: "red",
        month: "2026-10",
        sort: "name",
        page: "2",
      })
    ).toEqual({ q: "bilal", filter: "red", month: "2026-10", sort: "name", page: 2 })
  })

  it("falls back to defaults for anything unknown", () => {
    expect(
      parseClientsParams({
        filter: "purple",
        month: "2026-13",
        sort: "random",
        page: "-1",
      })
    ).toEqual(DEFAULT_PARAMS)
    expect(parseClientsParams({ q: ["a", "b"] }).q).toBe("a")
  })
})

describe("clientsHref", () => {
  it("omits defaults", () => {
    expect(clientsHref(DEFAULT_PARAMS, {})).toBe("/clients")
  })

  it("resets the page when anything else changes, keeps it for paging", () => {
    const current = { ...DEFAULT_PARAMS, q: "noor", page: 3 }
    expect(clientsHref(current, { filter: "orange" })).toBe(
      "/clients?q=noor&filter=orange"
    )
    expect(clientsHref(current, { page: 4 })).toBe("/clients?q=noor&page=4")
  })

  it("encodes the search", () => {
    expect(clientsHref(DEFAULT_PARAMS, { q: "sheikh & sons" })).toBe(
      "/clients?q=sheikh+%26+sons"
    )
  })
})
