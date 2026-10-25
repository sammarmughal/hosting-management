import { describe, expect, it } from "vitest"

import {
  isFiltered,
  listHref,
  parseClientListParams,
  parseCompanyListParams,
  parseInvoiceParams,
  parseReminderLogParams,
} from "@/lib/list-filters"
import {
  DEFAULT_PARAMS,
  hasActiveFilters,
  idParam,
  parseSubscriptionsParams,
  subscriptionsHref,
} from "@/lib/subscription-filters"

describe("parseSubscriptionsParams", () => {
  it("reads valid values", () => {
    expect(
      parseSubscriptionsParams({
        q: " bilal ",
        filter: "red",
        month: "2026-10",
        company: "12",
        service: "2",
        sort: "name",
        page: "2",
      })
    ).toEqual({
      q: "bilal",
      filter: "red",
      month: "2026-10",
      company: 12,
      service: 2,
      sort: "name",
      page: 2,
    })
  })

  it("falls back to defaults for anything unknown", () => {
    expect(
      parseSubscriptionsParams({
        filter: "purple",
        month: "2026-13",
        company: "abc",
        service: "-3",
        sort: "random",
        page: "-1",
      })
    ).toEqual(DEFAULT_PARAMS)
    expect(parseSubscriptionsParams({ q: ["a", "b"] }).q).toBe("a")
  })
})

describe("idParam", () => {
  it("takes positive integers only", () => {
    expect(idParam("7")).toBe(7)
    expect(idParam(["9", "1"])).toBe(9)
    for (const bad of ["0", "-1", "1.5", "1e3", "", undefined, "9999999999"])
      expect(idParam(bad)).toBe(0)
  })
})

describe("subscriptionsHref", () => {
  it("omits defaults", () => {
    expect(subscriptionsHref(DEFAULT_PARAMS, {})).toBe("/subscriptions")
  })

  it("resets the page when anything else changes, keeps it for paging", () => {
    const current = { ...DEFAULT_PARAMS, q: "noor", page: 3 }
    expect(subscriptionsHref(current, { filter: "orange" })).toBe(
      "/subscriptions?q=noor&filter=orange"
    )
    expect(subscriptionsHref(current, { company: 4 })).toBe(
      "/subscriptions?q=noor&company=4"
    )
    expect(subscriptionsHref(current, { page: 4 })).toBe("/subscriptions?q=noor&page=4")
  })

  it("encodes the search", () => {
    expect(subscriptionsHref(DEFAULT_PARAMS, { q: "sheikh & sons" })).toBe(
      "/subscriptions?q=sheikh+%26+sons"
    )
  })

  it("counts company and service as filters", () => {
    expect(hasActiveFilters(DEFAULT_PARAMS)).toBe(false)
    expect(hasActiveFilters({ ...DEFAULT_PARAMS, company: 3 })).toBe(true)
    expect(hasActiveFilters({ ...DEFAULT_PARAMS, service: 1 })).toBe(true)
  })
})

describe("client and company lists (docs/14 §7)", () => {
  it("parses search, client filter and page", () => {
    expect(parseClientListParams({ q: " noor ", page: "3" })).toEqual({
      q: "noor",
      page: 3,
    })
    expect(parseCompanyListParams({ q: "", client: "5", page: "x" })).toEqual({
      q: "",
      client: 5,
      page: 1,
    })
  })

  it("builds links without empty values and page 1", () => {
    expect(listHref("/companies", { q: "", client: 5, page: 1 })).toBe(
      "/companies?client=5"
    )
    expect(listHref("/clients", { q: "a b", page: 2 })).toBe("/clients?q=a+b&page=2")
    expect(listHref("/clients", { q: "", page: 1 })).toBe("/clients")
  })

  it("treats a company filter as a filter", () => {
    expect(isFiltered(parseCompanyListParams({}))).toBe(false)
    expect(isFiltered(parseCompanyListParams({ client: "2" }))).toBe(true)
    expect(isFiltered(parseReminderLogParams({ company: "2" }))).toBe(true)
    expect(parseInvoiceParams({ company: "8" }).company).toBe(8)
  })
})
