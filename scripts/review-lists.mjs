import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.BASE_URL ?? "http://localhost:3000"
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
page.on("console", (message) => {
  if (message.type() === "error" || /hydration/i.test(message.text()))
    errors.push(message.text())
})
const go = async (route) => {
  await page.goto(base + route, { waitUntil: "networkidle" })
  await page.locator("main").waitFor()
}
await mkdir("screenshots", { recursive: true })
try {
  await go("/reminders?tab=log")
  await page.getByRole("combobox", { name: "Channel" }).click()
  await page.getByRole("option", { name: "Email", exact: true }).click()
  await page.waitForURL(/channel=email/)
  await page.getByRole("combobox", { name: "Status", exact: true }).click()
  await page.getByRole("option", { name: "Failed", exact: true }).click()
  await page.waitForURL(/status=failed/)
  await page.getByRole("searchbox", { name: "Search reminders" }).fill("zainab")
  await page.waitForURL(/q=zainab/)
  await page.reload({ waitUntil: "networkidle" })
  assert.equal(await page.locator("tbody tr").count(), 1)
  await page.locator("tbody [tabindex='0']").focus()
  await page.getByRole("tooltip").waitFor()
  await page.keyboard.press("Escape")
  await go("/reminders?tab=log&q=nomatch")
  await page.getByText("No reminders match", { exact: false }).waitFor()

  await go("/payments")
  const tableFits = await page
    .locator("[data-slot=table-container]")
    .evaluate((el) => el.scrollWidth <= el.clientWidth)
  assert.ok(tableFits, "Payment columns and actions fit at 1440px")
  await page.getByLabel("From", { exact: true }).fill("2026-01-01")
  await page.waitForURL(/from=2026-01-01/)
  await page.getByLabel("To", { exact: true }).fill("2026-12-31")
  await page.waitForURL(/to=2026-12-31/)
  await page.getByRole("searchbox", { name: "Search payments" }).fill("karachi")
  await page.waitForURL(/q=karachi/)
  const exportHref = await page
    .getByRole("link", { name: "Export CSV" })
    .getAttribute("href")
  const csv = await (await page.request.get(base + exportHref)).text()
  assert.equal(csv.trim().split(/\r?\n/).length, 2, "CSV matches filtered payment")
  assert.ok(csv.includes("Karachi Auto Parts"))

  await go("/notifications")
  const bell = page.getByRole("button", { name: /^Notifications/ })
  await bell.click()
  await page
    .getByRole("menuitem")
    .filter({ has: page.locator("time") })
    .first()
    .waitFor()
  assert.ok(
    (await page
      .getByRole("menuitem")
      .filter({ has: page.locator("time") })
      .count()) <= 10
  )
  await page.screenshot({ caret: "initial", path: "screenshots/notification-bell-1440.png" })
  await page.keyboard.press("Escape")
  await page.getByRole("menu").waitFor({ state: "hidden" })
  await page.getByRole("button", { name: "Mark all read", exact: true }).click()
  await page.getByText("All read", { exact: true }).waitFor()
  assert.equal(await page.locator("main [aria-label=Unread]").count(), 0)
  assert.equal(await bell.getAttribute("aria-label"), "Notifications")

  for (const route of [
    "/reminders",
    "/reminders?tab=log",
    "/payments",
    "/notifications",
  ]) {
    await page.setViewportSize({ width: 360, height: 900 })
    await go(route)
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${route} fits at 360px`
    )
    await page.keyboard.press("Tab")
    assert.ok(
      await page.evaluate(() => {
        const style = getComputedStyle(document.activeElement)
        return style.outlineStyle !== "none" || style.boxShadow !== "none"
      }),
      "Keyboard focus has a visible indicator"
    )
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await go("/payments?q=karachi")
  await page.locator("tbody tr").first().hover()
  await page
    .getByRole("button", { name: /^Actions for/ })
    .filter({ visible: true })
    .click()
  await page.getByRole("menuitem", { name: "Delete payment" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.waitFor()
  assert.match(await dialog.innerText(), /not roll back the renewal date/)
  await page.screenshot({ caret: "initial", path: "screenshots/payment-delete-1440.png" })
  await page.keyboard.press("Escape")
  await dialog.waitFor({ state: "hidden" })
  // Delete only a disposable in-memory mock record, after verifying cancellation.
  await page.locator("tbody tr").first().hover()
  await page
    .getByRole("button", { name: /^Actions for/ })
    .filter({ visible: true })
    .click()
  await page.getByRole("menuitem", { name: "Delete payment" }).click()
  const serviceHref = await dialog
    .getByRole("link", { name: "Edit the service" })
    .getAttribute("href")
  const servicePage = await browser.newPage()
  await servicePage.goto(base + serviceHref, { waitUntil: "networkidle" })
  const before = await servicePage
    .getByLabel("Renewal date", { exact: false })
    .inputValue()
  await dialog.getByRole("button", { name: "Delete payment", exact: true }).click()
  await dialog.waitFor({ state: "hidden" })
  await page.getByText("No payments match", { exact: false }).waitFor()
  await servicePage.reload({ waitUntil: "networkidle" })
  const after = await servicePage
    .getByLabel("Renewal date", { exact: false })
    .inputValue()
  assert.ok(before, "Renewal date found")
  assert.equal(before, after, "Deleting payment preserves renewal date")
  assert.deepEqual(errors, [])
  console.log(
    "PASS: URL filters, filtered CSV, tooltip, bell, mark all read, 360px overflow, keyboard focus, Escape, payment deletion and renewal preservation"
  )
} finally {
  await browser.close()
}
