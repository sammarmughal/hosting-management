/**
 * Full-page screenshots for visual review (docs/12 §10).
 *
 *   npm run shots -- /styleguide /dashboard
 *
 * Writes ./screenshots/<route>-<width>.png at all five review widths. Uses the
 * server at BASE_URL (default http://localhost:3000), or starts `next dev`
 * if nothing is listening. Console errors, page errors and hydration
 * warnings are printed, and the exit code is 1 if there were any.
 */
import { spawn, type ChildProcess } from "node:child_process"
import { mkdir } from "node:fs/promises"
import path from "node:path"

import { chromium, type Browser, type Page } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
const WIDTHS = [360, 390, 768, 1024, 1440] as const
const OUT_DIR = path.resolve("screenshots")

function fileName(route: string, width: number) {
  const slug = route.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home"
  return `${slug}-${width}.png`
}

async function isUp(url: string) {
  try {
    const res = await fetch(url, { redirect: "manual" })
    return res.status < 500
  } catch {
    return false
  }
}

async function startDevServer(): Promise<ChildProcess> {
  const port = new URL(BASE_URL).port || "3000"
  console.log(`No server at ${BASE_URL}; starting next dev on port ${port}…`)
  // One command string: npx needs a shell on Windows, and `port` is numeric.
  const child = spawn(`npx next dev --port ${Number(port)}`, {
    stdio: "ignore",
    shell: true,
  })
  for (let i = 0; i < 120; i++) {
    if (await isUp(BASE_URL)) return child
    await new Promise((r) => setTimeout(r, 1000))
  }
  child.kill()
  throw new Error("next dev did not start within 120s")
}

async function launch(): Promise<Browser> {
  // Playwright's bundled Chromium first, then a locally installed Edge/Chrome.
  for (const channel of [undefined, "msedge", "chrome"] as const) {
    try {
      return await chromium.launch(channel ? { channel } : {})
    } catch (err) {
      if (!channel) console.warn("Bundled Chromium not found, trying a system browser…")
      if (channel === "chrome") throw err
    }
  }
  throw new Error("unreachable")
}

/**
 * Streaming pages (loading.tsx) can still be growing when "networkidle"
 * fires, especially on a first dev compile. Wait until the height has been
 * stable for 600 ms (max 10 s) so full-page shots aren't cut off.
 */
async function waitForStableHeight(page: Page) {
  let last = -1
  let stableSince = Date.now()
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    if (h !== last) {
      last = h
      stableSince = Date.now()
    } else if (Date.now() - stableSince >= 600) {
      return
    }
    await page.waitForTimeout(150)
  }
}

function stopServer(child: ChildProcess) {
  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" })
  } else {
    child.kill()
  }
}

async function main() {
  const routes = process.argv.slice(2).filter((a) => a.startsWith("/"))
  if (routes.length === 0) {
    console.error("Usage: npm run shots -- /route [/another-route …]")
    process.exit(2)
  }

  await mkdir(OUT_DIR, { recursive: true })
  const server = (await isUp(BASE_URL)) ? null : await startDevServer()
  const browser = await launch()
  let problems = 0

  try {
    for (const route of routes) {
      for (const width of WIDTHS) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          deviceScaleFactor: 1,
          reducedMotion: "reduce",
          hasTouch: width < 768,
          isMobile: width < 768,
        })
        const page = await context.newPage()
        const issues: string[] = []
        page.on("console", (msg) => {
          const text = msg.text()
          if (msg.type() === "error" || /hydrat/i.test(text))
            issues.push(`console: ${text}`)
        })
        page.on("pageerror", (err) => issues.push(`pageerror: ${err.message}`))

        const res = await page.goto(BASE_URL + route, { waitUntil: "networkidle" })
        await page.evaluate(() => document.fonts.ready)
        await waitForStableHeight(page)

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
        if (overflow > 0)
          issues.push(`horizontal page scroll: ${overflow}px wider than viewport`)

        const file = path.join(OUT_DIR, fileName(route, width))
        await page.screenshot({ caret: "initial", path: file, fullPage: true, animations: "disabled" })

        const status = res?.status() ?? 0
        console.log(
          `${status} ${route} @ ${width}px → ${path.relative(process.cwd(), file)}`
        )
        for (const issue of issues) console.log(`   ! ${issue}`)
        problems += issues.length + (status >= 400 ? 1 : 0)
        await context.close()
      }
    }
  } finally {
    await browser.close()
    if (server) stopServer(server)
  }

  if (problems > 0) {
    console.log(`\n${problems} problem(s) found.`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
