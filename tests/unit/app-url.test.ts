import { afterEach, describe, expect, it, vi } from "vitest"

import { appUrlProblem } from "@/lib/domain/app-url"
import { register } from "@/instrumentation"

describe("appUrlProblem", () => {
  it.each(["https://renewals.ourdomain.com", "https://renewals.ourdomain.com/", "https://app.rehmanweb.pk:8443"])(
    "accepts %s",
    (url) => expect(appUrlProblem(url)).toBeNull()
  )
  it.each([
    [undefined, "not set"],
    ["", "not set"],
    ["   ", "not set"],
    ["renewals.ourdomain.com", "not a valid URL"],
    ["http://renewals.ourdomain.com", "https"],
    ["https://localhost:3000", "this machine"],
    ["https://127.0.0.1", "this machine"],
    ["https://[::1]", "this machine"],
    ["https://app.localhost", "this machine"],
    ["https://renewals.ourdomain.com/app", "just the origin"],
  ])("rejects %j (%s)", (url, why) => {
    expect(appUrlProblem(url)).toContain(why)
  })
})

describe("startup check (instrumentation.ts)", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("refuses to start in production with a bad APP_URL", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("APP_URL", "http://localhost:3000")
    vi.stubEnv("ALLOW_LOCAL_APP_URL", "")
    expect(() => register()).toThrow(/Refusing to start: APP_URL must use https/)
    vi.stubEnv("APP_URL", "")
    expect(() => register()).toThrow(/APP_URL is not set/)
  })

  it("starts with a real https URL, in development, during the build, or with the local override", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("APP_URL", "https://renewals.ourdomain.com")
    expect(() => register()).not.toThrow()
    vi.stubEnv("APP_URL", "http://localhost:3000")
    vi.stubEnv("ALLOW_LOCAL_APP_URL", "1")
    expect(() => register()).not.toThrow()
    vi.stubEnv("ALLOW_LOCAL_APP_URL", "")
    vi.stubEnv("NEXT_PHASE", "phase-production-build")
    expect(() => register()).not.toThrow()
    vi.stubEnv("NEXT_PHASE", "")
    vi.stubEnv("NODE_ENV", "development")
    expect(() => register()).not.toThrow()
  })
})
