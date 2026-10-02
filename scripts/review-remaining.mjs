import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { chromium } from "@playwright/test"

const base = process.env.BASE_URL ?? "http://localhost:3000"
const browser = await chromium.launch()
await mkdir("screenshots", { recursive: true })
const problems = []
const routes = [
  "/login",
  "/2fa",
  "/2fa/setup",
  "/forgot",
  "/reset/preview",
  "/import",
  "/settings",
  "/settings?tab=reminders",
  "/settings?tab=email",
  "/settings?tab=templates",
  "/settings?tab=security",
  "/missing-page",
  "/403",
  "/419",
  "/500",
]
const slug = (s) => s.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-")

async function capture(page, name, width) {
  await page.evaluate(() => document.fonts.ready)
  // Cross-origin sandboxed email previews must finish loading before capture.
  for (const f of page.frames().slice(1)) await f.waitForLoadState("load")
  for (const [i, frame] of (await page.locator("iframe").all()).entries()) {
    await frame.scrollIntoViewIfNeeded()
    await page.waitForTimeout(150)
    await frame.screenshot({ path: `screenshots/${name}-preview-${i + 1}-${width}.png` })
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(700)
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    `${name}: no page overflow at ${width}`
  )
  await page.screenshot({ caret: "initial",
    path: `screenshots/${name}-${width}.png`,
    fullPage: true,
    animations: "disabled",
  })
}
async function pasteCode(page, code = "123456") {
  await page.getByLabel("Digit 1", { exact: true }).evaluate((el, value) => {
    const data = new DataTransfer()
    data.setData("text", value)
    el.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      })
    )
  }, code)
  assert.equal(await page.getByLabel("Digit 6", { exact: true }).inputValue(), code[5])
}
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
      hasTouch: width === 390,
    })
    const page = await context.newPage()
    page.on("pageerror", (e) => problems.push(e.message))
    page.on("console", (m) => {
      const expectedHttpError =
        (m.location().url === base + "/missing-page" &&
          m.text().includes("404 (Not Found)")) ||
        (m.location().url === base + "/500" &&
          m.text().includes("500 (Internal Server Error)"))
      if ((m.type() === "error" || /hydration/i.test(m.text())) && !expectedHttpError)
        problems.push(m.text())
    })
    const go = async (route) => {
      await page.goto(base + route, { waitUntil: "networkidle" })
    }
    for (const route of routes) {
      await go(route)
      await capture(page, slug(route), width)
      if (route.includes("templates"))
        assert.match(
          await page.frameLocator("iframe").first().locator("body").innerText(),
          /Dear Ayesha Siddiqui/
        )
      await page.setViewportSize({ width: 360, height: 900 })
      await page.waitForTimeout(150)
      assert.ok(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} fits at 360px`
      )
      await page.setViewportSize({ width, height: 900 })
    }
    console.log(`Captured all page views at ${width}px; no overflow at 360px`)

    await go("/login")
    await page.getByLabel("Username or email").fill("rehman")
    await page.getByLabel("Password", { exact: true }).fill("wrong")
    await page.getByRole("button", { name: "Show password", exact: true }).click()
    assert.equal(
      await page.getByLabel("Password", { exact: true }).getAttribute("type"),
      "text"
    )
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.getByText("Invalid credentials.", { exact: true }).waitFor()
    await capture(page, "login-error", width)
    await page.getByLabel("Password", { exact: true }).fill("Renewals2026!")
    await page.getByRole("button", { name: "Sign in", exact: true }).click()
    await page.waitForURL("**/2fa")
    await page.getByLabel("Digit 1", { exact: true }).fill("1")
    assert.equal(
      await page
        .getByLabel("Digit 2", { exact: true })
        .evaluate((el) => el === document.activeElement),
      true
    )
    await page.getByRole("button", { name: "Use a recovery code instead" }).click()
    await capture(page, "2fa-recovery", width)
    await page.getByRole("button", { name: "Use an authenticator code instead" }).click()
    await pasteCode(page)
    await page.getByRole("button", { name: "Verify", exact: true }).click()
    await page.waitForURL("**/dashboard")
    await go("/2fa/setup")
    await page.getByRole("button", { name: "Continue", exact: true }).click()
    await capture(page, "2fa-setup-verify", width)
    await pasteCode(page)
    await page.getByRole("button", { name: "Confirm code" }).click()
    await page.getByRole("heading", { name: "Save your recovery codes" }).waitFor()
    assert.equal(
      await page.getByLabel("Recovery codes", { exact: true }).locator("code").count(),
      8
    )
    assert.ok(
      await page.getByRole("button", { name: "Continue", exact: true }).isDisabled()
    )
    const recoveryDownload = page.waitForEvent("download")
    await page.getByRole("button", { name: "Download .txt" }).click()
    assert.equal(
      (await recoveryDownload).suggestedFilename(),
      "renewals-recovery-codes.txt"
    )
    await capture(page, "2fa-setup-recovery-codes", width)
    await page.getByRole("checkbox").check()
    assert.ok(
      await page.getByRole("button", { name: "Continue", exact: true }).isEnabled()
    )

    await go("/forgot")
    await page.getByLabel("Email", { exact: true }).fill("ayesha@ayeshacouture.pk")
    await page.getByRole("button", { name: "Send reset link" }).click()
    await page.getByText("If an account matches", { exact: false }).waitFor()
    await capture(page, "forgot-confirmation", width)
    await go("/reset/preview")
    await page.getByLabel("New password", { exact: true }).fill("NewRenewals2026!")
    await page.getByLabel("Confirm password", { exact: true }).fill("NewRenewals2026!")
    await page.getByRole("button", { name: "Save password" }).click()
    await page.getByText("Your password has been reset.", { exact: false }).waitFor()
    await capture(page, "reset-confirmation", width)

    await go("/import")
    const input = page.getByLabel("CSV file", { exact: true })
    await input.setInputFiles({
      name: "clients.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("no"),
    })
    await page.getByText("Choose a .csv file.", { exact: true }).waitFor()
    await capture(page, "import-file-error", width)
    const header =
      "client_name,company,email,phone,domain,plan_label,start_date,renewal_date,charge_amount,currency,notes\n"
    const csv =
      header +
      `Faisal Ahmed,Faisal Print,faisal@faisalprint.pk,,faisalprint${Date.now()}.pk,Shared,2025-09-30,2026-09-30,6500,PKR,\n` +
      "Ayesha Siddiqui,Ayesha Couture,ayesha@ayeshacouture.pk,,ayeshacouture.pk,Shared,2025-09-30,2026-09-30,6500,PKR,\n" +
      "Nadia Khan,,nadia@nadia.pk,,,Shared,2025-09-30,2026-09-30,6500,PKR,\n"
    await input.setInputFiles({
      name: "clients.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    })
    await page.getByRole("button", { name: "Import 1 row", exact: true }).waitFor()
    await capture(page, "import-preview", width)
    await page.getByRole("checkbox", { name: "Update existing domains" }).check()
    await page.getByRole("button", { name: "Import 2 rows", exact: true }).waitFor()
    await page.getByRole("checkbox", { name: "Update existing domains" }).uncheck()
    await page.getByRole("button", { name: "Import 1 row", exact: true }).click()
    await page.getByRole("heading", { name: "Import complete" }).waitFor()
    await page.getByText("1 created · 0 updated · 2 skipped").waitFor()
    await capture(page, "import-done", width)

    await go("/settings")
    const save = page.getByRole("button", { name: "Save business", exact: true })
    assert.ok(await save.isDisabled())
    await page
      .getByLabel("Business name", { exact: true })
      .fill("Rehman Hosting Services")
    assert.ok(await save.isEnabled())
    await save.click()
    await page.getByText("Business saved", { exact: true }).waitFor()
    assert.ok(await save.isDisabled())
    await page.reload({ waitUntil: "networkidle" })
    assert.equal(
      await page.getByLabel("Business name", { exact: true }).inputValue(),
      "Rehman Hosting Services"
    )
    await page.getByLabel("Business name", { exact: true }).fill("Rehman Web Services")
    await page.getByRole("button", { name: "Save business", exact: true }).click()
    await page.getByText("Business saved", { exact: true }).waitFor()
    await go("/settings?tab=reminders")
    await page.getByLabel("Reminder stages", { exact: true }).fill("-12")
    await page.getByRole("button", { name: "Add stage" }).click()
    await page
      .getByRole("button", { name: "Remove 12 days after expiry", exact: true })
      .waitFor()
    await page
      .getByRole("button", { name: "Remove 12 days after expiry", exact: true })
      .click()
    assert.ok(
      await page.getByRole("button", { name: "Save reminders", exact: true }).isDisabled()
    )
    await go("/settings?tab=templates")
    const body = page.locator("#client_email-body")
    await body.fill("<p>Dear ,</p>")
    await body.evaluate((el) => {
      el.focus()
      el.setSelectionRange(8, 8)
    })
    await page.getByRole("button", { name: "{client_name}", exact: true }).first().click()
    assert.equal(await body.inputValue(), "<p>Dear {client_name},</p>")
    await page.frameLocator("iframe").first().getByText("Dear Ayesha Siddiqui,").waitFor()
    assert.ok(
      await page
        .getByRole("button", { name: "Save client email", exact: true })
        .isEnabled()
    )
    assert.ok(
      await page
        .getByRole("button", { name: "Save client whatsapp", exact: true })
        .isDisabled()
    )
    await page
      .getByRole("button", { name: "Reset to default", exact: true })
      .first()
      .click()
    assert.ok(
      await page
        .getByRole("button", { name: "Save client email", exact: true })
        .isDisabled()
    )

    await go("/settings?tab=security")
    await page
      .getByRole("button", { name: "Regenerate recovery codes", exact: true })
      .click()
    await page.getByRole("dialog").waitFor()
    await capture(page, "security-recovery-confirm", width)
    await page.keyboard.press("Escape")
    await page.getByRole("dialog").waitFor({ state: "hidden" })
    await page
      .getByRole("button", { name: "Regenerate recovery codes", exact: true })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Current password", { exact: true }).fill("Renewals2026!")
    await dialog
      .getByRole("button", { name: "Regenerate recovery codes", exact: true })
      .click()
    await dialog.getByText("Save your recovery codes", { exact: true }).waitFor()
    assert.equal(await dialog.locator("code").count(), 8)
    await dialog.getByRole("checkbox").check()
    await dialog.getByRole("button", { name: "Continue", exact: true }).click()
    console.log(`PASS interaction flows at ${width}px`)
    await context.close()
  }
  assert.deepEqual(problems, [], "No unexpected console, hydration or runtime errors")
  console.log("PASS all remaining screens")
} finally {
  await browser.close()
}
