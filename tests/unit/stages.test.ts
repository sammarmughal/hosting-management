import { describe, expect, it } from "vitest"

import { DEFAULT_STAGES, dueStage, parseStages, stageLabel } from "@/lib/domain/stages"

describe("stageLabel", () => {
  it.each([
    [30, "30 days before expiry"],
    [1, "1 day before expiry"],
    [0, "Expiry day"],
    [-1, "1 day after expiry"],
    [-9, "9 days after expiry"],
  ])("%i → %s", (stage, expected) => {
    expect(stageLabel(stage)).toBe(expected)
  })
})

describe("parseStages", () => {
  it("parses the default setting, sorted descending", () => {
    expect(parseStages(DEFAULT_STAGES)).toEqual([30, 15, 7, 3, 1, 0, -3, -6, -9])
  })
  it("sorts unsorted input", () => {
    expect(parseStages("0,30,7")).toEqual([30, 7, 0])
  })
  it("drops blanks, duplicates and non-integers", () => {
    expect(parseStages(" 7, ,7,abc,1.5,-3 ")).toEqual([7, -3])
  })
  it("accepts a number list", () => {
    expect(parseStages([1, 30, 15])).toEqual([30, 15, 1])
  })
  it("returns [] for an empty setting", () => {
    expect(parseStages("")).toEqual([])
  })
})

describe("dueStage (30,15,7,3,1,0,−3,−6,−9)", () => {
  const stages = parseStages(DEFAULT_STAGES)
  it.each([
    [45, null],
    [31, null],
    [30, 30],
    [22, 30],
    [15, 15],
    [12, 15],
    [7, 7],
    [5, 7],
    [3, 3],
    [2, 3],
    [1, 1],
    [0, 0],
    [-1, 0],
    [-2, 0],
    [-3, -3],
    [-4, -3],
    [-5, -3],
    [-6, -6],
    [-8, -6],
    [-9, -9],
    [-40, -9],
    [-100, -9],
  ])("d=%i → %s", (d, expected) => {
    expect(dueStage(d, stages)).toBe(expected)
  })

  it("works on unsorted input", () => {
    expect(dueStage(5, [0, 30, 7])).toBe(7)
  })

  it("is always null with no stages", () => {
    expect(dueStage(0, [])).toBeNull()
    expect(dueStage(-5, [])).toBeNull()
  })
})
