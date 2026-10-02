import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.BASE_URL ?? "http://localhost:3002"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on("pageerror", e => errors.push(e.message))
page.on("console", m => { if (m.type() === "error" || /hydrat/i.test(m.text())) errors.push(m.text()) })
const go = route => page.goto(base + route, { waitUntil: "networkidle" })
const out = "screenshots/audit/states"
await mkdir(out, { recursive: true })
const checks = []
try {
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await go("/payments")
    await page.keyboard.press("/")
    assert.equal(await page.getByRole("searchbox", { name: "Search payments" }).evaluate(e => e === document.activeElement), true)
    await page.keyboard.type("n")
    assert.ok(!page.url().includes("/clients/new"), "N is ignored while typing")
    await page.keyboard.press("Escape")
    await go("/dashboard")
    await page.keyboard.press("/")
    if (width < 768) {
      await page.waitForURL(/clients\?focus=search/)
      await page.getByRole("searchbox", { name: "Search clients", exact: true }).waitFor()
      await page.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "Search clients")
    } else {
      assert.equal(await page.locator("#global-search").evaluate(e => e === document.activeElement), true)
    }
    await page.keyboard.press("Escape")
    await page.keyboard.press("n")
    await page.waitForURL(/\/clients\/new/)
    await page.getByLabel("Name", { exact: false }).waitFor()

    await go("/clients/1")
    await page.getByRole("button", { name: "Record renewal", exact: true }).click()
    const dialog = page.getByRole("dialog")
    await dialog.waitFor()
    for (let i = 0; i < 22; i++) {
      await page.keyboard.press(i % 3 === 0 ? "Shift+Tab" : "Tab")
      assert.ok(await dialog.evaluate(el => el.contains(document.activeElement)), "Dialog traps keyboard focus")
    }
    await page.screenshot({ caret: "initial", path: `${out}/renew-dialog-${width}.png`, fullPage: true })
    await page.keyboard.press("Escape")
    await dialog.waitFor({ state: "hidden" })
    assert.ok(await page.getByRole("button", { name: "Record renewal", exact: true }).evaluate(e => e === document.activeElement), "Closing restores trigger focus")
    if (width < 768) {
      await go("/settings?tab=email")
      assert.equal(await page.locator(".form-action-bar").filter({ visible: true }).evaluate(e => getComputedStyle(e).position), "sticky")
    }
    checks.push(`Search, N, typing exclusion, focus trap, Escape and focus restoration at ${width}px`)
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await go("/clients")
  const geometry = () => page.locator(".timer-pill").evaluateAll(es => es.filter(e => e.getBoundingClientRect().width).map(e => ({ width: e.getBoundingClientRect().width, x: e.getBoundingClientRect().x })))
  const before = await geometry()
  await page.waitForTimeout(2200)
  assert.deepEqual(await geometry(), before, "Timer columns remain stable across ticks")
  for (const route of ["/clients?q=unmatched-query", "/payments?q=unmatched-query", "/reminders?tab=log&q=unmatched-query", "/clients/5?tab=log"]) {
    await go(route)
    assert.match(await page.locator("main").innerText(), /No .*match|No reminders yet/i)
    await page.screenshot({ caret: "initial", path: `${out}/${route.replace(/[^a-z0-9]/gi, "-")}-1440.png`, fullPage: true })
  }
  checks.push("Timer geometry stable over two ticks; clients, payments, reminders and client history empty states")

  await go("/clients/1")
  const send = page.getByRole("button", { name: "Send reminder", exact: true })
  let release
  const responseGate = new Promise(resolve => { release = resolve })
  // Return a failed action transport response without emitting a browser network error.
  await page.route("**/*", async route => {
    if (route.request().method() === "POST") {
      await responseGate
      await route.fulfill({ status: 200, contentType: "text/plain", body: "Action unavailable" })
    } else await route.continue()
  })
  await send.click()
  await page.waitForFunction(() => [...document.querySelectorAll("button")].find(e => e.textContent.includes("Send reminder"))?.disabled)
  release()
  await page.getByText("Couldn’t complete this action. Check your connection and try again.", { exact: true }).waitFor()
  await page.waitForFunction(() => ![...document.querySelectorAll("button")].find(e => e.textContent.includes("Send reminder"))?.disabled)
  await page.screenshot({ caret: "initial", path: `${out}/send-failure-1440.png`, fullPage: true })
  await page.unroute("**/*")
  checks.push("Failed async transport displays recovery feedback and clears pending")
  assert.deepEqual(errors, [], "No unexpected browser errors")
  await writeFile(`${out}/checks.json`, JSON.stringify({ checks, errors }, null, 2))
  console.log("PASS", checks.join("\n"))
} finally { await browser.close() }
