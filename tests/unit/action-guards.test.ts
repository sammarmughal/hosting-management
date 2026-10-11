// docs/05 §2 and docs/09 Phase 3: "every action calls requireAdmin() first".
// A static check over src/actions/*.ts and the route handlers, so a new
// action or route can't ship without its guard.
import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const ACTIONS = path.resolve("src/actions")
const ROUTES = path.resolve("src/app")

/** Auth actions run before full sign-in; they use these guards instead. */
const AUTH_GUARDS: Record<string, RegExp> = {
  loginAction: /isLocked\(/, // throttled; creates the password-stage session
  requestResetAction: /isLocked\(/, // always answers the same, throttled
  resetPasswordAction: /passwordReset\.findUnique/, // the one-time token is the check
  logoutAction: /endSession\(/,
  verifyCodeAction: /requirePasswordStage\(\)/,
  setupCodeAction: /requirePasswordStage\(\)/,
  finishSetupAction: /requirePasswordStage\(\)/,
}

/** The body of each exported async function, up to the next export. */
function exportedFunctions(source: string) {
  const re = /export async function (\w+)\s*\(/g
  const found: { name: string; body: string }[] = []
  const starts = [...source.matchAll(re)]
  starts.forEach((m, i) => {
    const end = starts[i + 1]?.index ?? source.length
    found.push({ name: m[1]!, body: source.slice(m.index!, end) })
  })
  return found
}

/** The first awaited call: nothing (no DB, no input handling) may run before the guard. */
function firstAwait(body: string) {
  return /await\s+([\w.]+)\(/.exec(body)?.[1]
}

describe("server actions are guarded (docs/05 §2)", () => {
  const files = fs.readdirSync(ACTIONS).filter((f) => f.endsWith(".ts"))

  it("finds the action files", () => {
    expect(files).toEqual(
      expect.arrayContaining(["auth.ts", "clients.ts", "invoices.ts", "reminders.ts", "settings.ts"])
    )
  })

  for (const file of files) {
    const source = fs.readFileSync(path.join(ACTIONS, file), "utf8")
    it(`${file} is a "use server" file`, () => {
      expect(source.trimStart().startsWith('"use server"')).toBe(true)
    })
    for (const fn of exportedFunctions(source)) {
      it(`${file} › ${fn.name} checks access first`, () => {
        const guard = AUTH_GUARDS[fn.name]
        if (file === "auth.ts") {
          expect(guard, `${fn.name} needs an entry in AUTH_GUARDS`).toBeDefined()
          expect(fn.body).toMatch(guard!)
        } else {
          expect(firstAwait(fn.body)).toBe("requireAdmin")
        }
      })
    }
  }
})

describe("route handlers are guarded", () => {
  /** Public by design: health check, the token-checked invoice link, and the bearer-token cron route. */
  const PUBLIC = [
    path.join("api", "health", "route.ts"),
    path.join("i", "[token]", "pdf", "route.ts"),
    path.join("api", "cron", "check", "route.ts"),
  ]
  const routes: string[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name === "route.ts") routes.push(path.relative(ROUTES, p))
    }
  }
  walk(ROUTES)

  for (const route of routes) {
    it(`${route} ${PUBLIC.includes(route) ? "is a known public route" : "calls requireAdmin()"}`, () => {
      const source = fs.readFileSync(path.join(ROUTES, route), "utf8")
      if (route.endsWith(path.join("cron", "check", "route.ts")))
        expect(source).toMatch(/timingSafeEqual/)
      else if (!PUBLIC.includes(route)) expect(source).toMatch(/await requireAdmin\(\)/)
    })
  }

  it("the (app) layout and the dashboard page check the session", () => {
    expect(fs.readFileSync(path.join(ROUTES, "(app)", "layout.tsx"), "utf8")).toMatch(/await requireAdmin\(\)/)
    // The dashboard writes (runCheck) while rendering, so it checks too.
    expect(fs.readFileSync(path.join(ROUTES, "(app)", "dashboard", "page.tsx"), "utf8")).toMatch(
      /await requireAdmin\(\)[\s\S]*await runCheck/
    )
  })
})

describe("no secrets on the client", () => {
  it("no NEXT_PUBLIC_ variables are used", () => {
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (e.name !== "generated") walk(p)
        } else if (/\.(ts|tsx)$/.test(e.name) && fs.readFileSync(p, "utf8").includes("NEXT_PUBLIC_"))
          hits.push(p)
      }
    }
    walk(path.resolve("src"))
    expect(hits).toEqual([])
  })

  it("server modules are marked server-only", () => {
    const dir = path.resolve("src/lib/server")
    const allowed = ["db-dates.ts", "settings-keys.ts"] // pure; shared with the seed script
    for (const f of fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !allowed.includes(f)))
      expect(fs.readFileSync(path.join(dir, f), "utf8"), f).toMatch(/^import "server-only"/)
  })
})
