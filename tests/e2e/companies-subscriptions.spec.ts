// docs/14 §11 E2E: client → company → subscription under the company →
// Check now → the invoice shows the company (page and public link) → PDF →
// a used catalog type can't be deleted → deleting the company says what goes.
import { expect, test } from "@playwright/test"

import { addDays, todayPK } from "../../src/lib/domain/dates"
import { signIn } from "./sign-in"
import { addClient, addCompany, addSubscription } from "./ui-helpers"

const DOMAIN = "e2e-kapstore.pk"

test("companies and subscriptions: invoice bill-to, catalog lock, company delete", async ({
  page,
  context,
  browser,
}) => {
  const today = todayPK()
  await signIn(page)

  // 1. Client, company, and a subscription under the company.
  const clientPath = await addClient(page, {
    name: "Imran Qureshi E2E",
    email: "imran@e2e-kap.pk",
    phone: "0345 2233445",
  })
  await addCompany(page, clientPath, {
    name: "KAP Online Store",
    email: "orders@e2e-kap.pk",
    address: "Shahrah-e-Faisal, Karachi",
  })
  await expect(page.getByText("KAP Online Store").first()).toBeVisible()
  await addSubscription(page, clientPath, {
    service: "Domain and Hosting",
    company: "KAP Online Store",
    domain: DOMAIN,
    start: addDays(today, -355),
    renewal: addDays(today, 10),
    charge: "9,500",
  })
  // Grouped under its company on the client page.
  const group = page.getByRole("heading", { name: /KAP Online Store/ })
  await expect(group).toBeVisible()

  // The list filters by company.
  await page.goto("/subscriptions")
  await page.getByRole("combobox", { name: "Company" }).click()
  await page.getByRole("option", { name: "KAP Online Store — Imran Qureshi E2E" }).click()
  await expect(page).toHaveURL(/company=\d+/)
  await expect(page.getByText(DOMAIN).first()).toBeVisible()

  // 2. Check now creates the invoice (10 days ≤ the 30-day lead).
  await page.goto("/dashboard")
  await page.getByRole("button", { name: "Check now" }).click()
  await expect(page.getByText(/Checked \d+ subscriptions?/)).toBeVisible()
  await expect(
    page.getByText("Domain and Hosting · KAP Online Store").first()
  ).toBeVisible()

  // 3. The invoice: the company under the client's name.
  await page.goto(`/invoices?q=${DOMAIN}`)
  await expect(page.getByText("KAP Online Store").first()).toBeVisible()
  await page
    .getByRole("link", { name: /^INV-\d{4}-\d{4}$/ })
    .first()
    .click()
  await page.waitForURL(/\/invoices\/\d+$/)
  const billTo = page.getByRole("region", { name: "Bill to" })
  await expect(billTo).toContainText("Imran Qureshi E2E")
  await expect(billTo.getByLabel("Company")).toContainText("KAP Online Store")
  await expect(billTo.getByLabel("Company")).toContainText("orders@e2e-kap.pk")
  await expect(page.getByText(`Domain and Hosting — ${DOMAIN}`)).toBeVisible()

  // …and on the public page, which also serves the PDF.
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await page.getByRole("button", { name: "Copy link" }).click()
  const publicUrl = await page.evaluate(() => navigator.clipboard.readText())
  expect(publicUrl).toMatch(/\/i\/[0-9a-f]{64}$/)
  const anon = await browser.newContext()
  const pub = await anon.newPage()
  await pub.goto(publicUrl)
  await expect(
    pub.getByRole("region", { name: "Bill to" }).getByLabel("Company")
  ).toContainText("KAP Online Store")
  const pdf = await pub.request.get(`${publicUrl}/pdf`)
  expect(pdf.headers()["content-type"]).toBe("application/pdf")
  await anon.close()

  // 4. Service Catalog: the used type can't be deleted; the tooltip says why.
  await page.goto("/service-catalog")
  const del = page.getByRole("button", { name: "Delete Domain and Hosting" })
  await expect(del).toBeDisabled()
  await del.locator("..").hover()
  await expect(page.getByRole("tooltip")).toContainText(
    "Used by 1 subscription, so it can't be deleted"
  )
  // An unused type can be deleted.
  await expect(page.getByRole("button", { name: "Delete AMC" })).toBeEnabled()

  // 5. The new screens fit a 360 px phone: no sideways page scroll (CLAUDE.md, docs/12).
  await page.setViewportSize({ width: 360, height: 780 })
  for (const path of [
    "/clients",
    clientPath,
    `${clientPath}?tab=companies`,
    `${clientPath}?tab=subscriptions`,
    "/companies",
    "/service-catalog",
    "/subscriptions",
    "/subscriptions/new",
    "/import?kind=subscriptions",
  ]) {
    await page.goto(path)
    await expect(page.locator("main")).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, path).toBe(0)
  }
  await page.setViewportSize({ width: 1440, height: 900 })

  // 6. Deleting the company lists what goes with it, then removes it.
  await page.goto("/companies")
  await page.getByRole("button", { name: "Actions for KAP Online Store" }).first().click()
  await page.getByRole("menuitem", { name: "Delete company" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toContainText(
    "This deletes 1 subscription, 1 invoice and their reminders. This can't be undone."
  )
  await dialog.getByRole("button", { name: "Delete company" }).click()
  await expect(page.getByText("KAP Online Store deleted")).toBeVisible()
  await page.goto("/subscriptions")
  await expect(page.locator("main")).toBeVisible()
  await expect(page.getByText(DOMAIN)).toHaveCount(0)
})
