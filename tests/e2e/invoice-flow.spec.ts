// docs/13 §12 E2E: client + service renewing in 20 days → run check → invoice
// exists → share by email with the PDF attached → open /i/<token> → the PDF
// download is application/pdf → mark as paid → renewal +1 year, invoice paid.
import fs from "node:fs"

import { expect, test } from "@playwright/test"

import { addDays, addOneYear, formatDatePK, todayPK } from "../../src/lib/domain/dates"
import { E2E } from "./e2e-config"
import { signIn } from "./sign-in"

const DOMAIN = "e2e-noordental.pk"

function mailbox(): { rcpt: string[]; data: string }[] {
  return fs
    .readFileSync(E2E.mailbox, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l))
}

test("invoice lifecycle: check → invoice → email with PDF → public link → paid", async ({
  page,
  context,
  browser,
}) => {
  const today = todayPK()
  const renewal = addDays(today, 20)

  // Logged out: protected pages redirect to /login.
  await page.goto("/clients")
  await expect(page).toHaveURL(/\/login$/)

  await signIn(page)

  // 1. Client + service renewing in 20 days.
  await page.goto("/clients/new")
  await page.fill("#client-name", "Noor Dental Clinic E2E")
  await page.fill("#client-email", "info@e2e-noordental.pk")
  await page.fill("#client-phone", "0321 4455667")
  await page.fill("#service-domain", DOMAIN)
  await page.fill("#service-startDate", addDays(renewal, -365))
  await page.fill("#service-renewalDate", renewal)
  await page.fill("#service-chargeAmount", "8,750")
  await page.getByRole("button", { name: "Save client" }).click()
  await page.waitForURL(/\/clients\/\d+\?saved=client/)
  const clientUrl = page.url().split("?")[0]!

  // 2. Run the check (no cron: the "Check now" button).
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Check now" }).click()
  await expect(page.getByText(/Checked \d+ services?/)).toBeVisible()

  // 3. The invoice exists.
  await page.goto(`/invoices?q=${DOMAIN}`)
  const number = page.getByRole("link", { name: /^INV-\d{4}-\d{4}$/ }).first()
  await expect(number).toBeVisible()
  const invoiceNumber = (await number.innerText()).trim()
  expect(invoiceNumber).toMatch(new RegExp(`^INV-${today.slice(0, 4)}-0001$`))
  await number.click()
  await page.waitForURL(/\/invoices\/\d+$/)
  const invoiceUrl = page.url()

  // 4. Share by email; the catcher receives it with the PDF attached.
  await page.getByRole("button", { name: "Share invoice" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("radio", { name: /Email/ }).click()
  await dialog.getByRole("button", { name: "Send email" }).click()
  await expect(dialog.getByText("Email sent to info@e2e-noordental.pk")).toBeVisible({ timeout: 30_000 })
  const mail = mailbox().at(-1)!
  expect(mail.rcpt.join(" ")).toContain("info@e2e-noordental.pk")
  expect(mail.data).toContain("application/pdf")
  expect(mail.data).toContain(`Invoice-${invoiceNumber}-${DOMAIN}.pdf`)
  await dialog.getByRole("button", { name: "Close" }).first().click()
  await page.reload()
  await expect(page.getByText("Sent", { exact: true }).first()).toBeVisible()

  // 5. The public link, on a phone, without a session.
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.getByRole("button", { name: "Copy link" }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toMatch(/\/i\/[0-9a-f]{64}$/)
  expect(mail.data.replace(/=\r?\n/g, "")).toContain(link.split("/i/")[1])

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const pub = await phone.newPage()
  const res = await pub.goto(link)
  expect(res?.headers()["x-robots-tag"]).toContain("noindex")
  await expect(pub.getByText(invoiceNumber)).toBeVisible()
  const overflow = await pub.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBe(0)

  // 6. PDF download returns application/pdf.
  const pdf = await pub.request.get(`${link}/pdf`)
  expect(pdf.status()).toBe(200)
  expect(pdf.headers()["content-type"]).toBe("application/pdf")
  expect(pdf.headers()["content-disposition"]).toBe(
    `attachment; filename="Invoice-${invoiceNumber}-${DOMAIN}.pdf"`
  )
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-")
  await phone.close()

  // 7. Mark as paid → renewal moves by one year, invoice paid.
  await page.goto(invoiceUrl)
  await page.getByRole("button", { name: "Mark as paid" }).click()
  const renew = page.getByRole("dialog")
  await expect(renew.locator("#renew-amount")).toHaveValue("8,750")
  const next = addOneYear(renewal)
  await renew.getByRole("button", { name: `Renew until ${formatDatePK(next)}` }).click()
  await expect(page.getByText(`${DOMAIN} renewed until ${formatDatePK(next)}`)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/^Paid on /).first()).toBeVisible()
  await page.goto(clientUrl)
  await expect(page.getByText(formatDatePK(next)).first()).toBeVisible()
})
