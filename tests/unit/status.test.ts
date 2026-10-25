import { describe, expect, it } from "vitest"

import { subscriptionColour, statusColour } from "@/lib/domain/status"

describe("statusColour (defaults T_o=30, T_r=7)", () => {
  it.each([
    [31, "green"],
    [30, "orange"],
    [8, "orange"],
    [7, "red"],
    [1, "red"],
    [0, "red"],
    [-1, "expired"],
    [-365, "expired"],
  ])("%i days → %s", (days, colour) => {
    expect(statusColour(days)).toBe(colour)
  })
})

describe("statusColour (custom T_o=45, T_r=10)", () => {
  const t = { orange: 45, red: 10 }
  it.each([
    [46, "green"],
    [45, "orange"],
    [11, "orange"],
    [10, "red"],
  ])("%i days → %s", (days, colour) => {
    expect(statusColour(days, t)).toBe(colour)
  })
})

describe("subscriptionColour", () => {
  it("is cancelled regardless of days", () => {
    expect(subscriptionColour(3, "cancelled")).toBe("cancelled")
    expect(subscriptionColour(-10, "cancelled")).toBe("cancelled")
  })
  it("uses statusColour for active services", () => {
    expect(subscriptionColour(3, "active")).toBe("red")
  })
})
