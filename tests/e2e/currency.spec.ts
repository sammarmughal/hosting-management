// docs/13 §6 E2E: enable any ISO currency from the searchable picker, give a
// client their own currency (the first service follows), and a currency in
// use can't be removed.
import { expect, test } from "@playwright/test"

import { signIn } from "./sign-in"

test("currencies: picker, client currency, in-use lock", async ({ page }) => {
  await signIn(page)

  // 1. Settings → Business: PKR, USD and AED are on; add KWD by searching its name.
  await page.goto("/settings?tab=business")
  const list = page.locator("fieldset", { hasText: "Currencies" }).locator("ul").first()
  await expect(list.locator("li")).toHaveText([/^AED · /, /^PKR · /, /^USD · /])
  await expect(page.getByRole("button", { name: /^Can’t remove PKR/ })).toBeDisabled()
  await page.getByRole("button", { name: "Add currency" }).click()
  await page.getByRole("textbox", { name: "Search currencies" }).fill("kuwait")
  await page.getByRole("button", { name: /^KWD\s*Kuwaiti Dinar$/ }).click()
  await expect(list.locator("li")).toHaveCount(4)
  await page.getByRole("button", { name: "Save business" }).click()
  await expect(page.getByText("Business saved")).toBeVisible()
  await page.reload()
  await expect(list.getByText("KWD", { exact: true })).toBeVisible()

  // 2. A UAE client in AED: the first service follows the client's currency.
  await page.goto("/clients/new")
  await page.fill("#client-name", "Gulf Traders E2E")
  await page.fill("#client-email", "accounts@gulftraders-e2e.ae")
  await page.fill("#client-phone", "+971 54 775 7581")
  await page.locator("#client-currency").click()
  await page.getByRole("option", { name: /^AED · / }).click()
  await expect(page.locator('[aria-label="Currency"]')).toHaveText("AED")
  await page.fill("#service-domain", "gulftraders-e2e.ae")
  // AED has 2 decimals: 1,250.505 is refused, 1,250.50 is fine.
  await page.fill("#service-chargeAmount", "1,250.505")
  await page.getByRole("button", { name: "Save client" }).click()
  await expect(page.getByText("AED amounts have at most 2 decimals")).toBeVisible()
  await page.fill("#service-chargeAmount", "1,250.50")
  await page.getByRole("button", { name: "Save client" }).click()
  await page.waitForURL(/\/clients\/\d+\?saved=client/)
  const clientPath = new URL(page.url()).pathname
  const contact = page.locator('section[aria-labelledby="contact-title"]')
  await expect(contact).toContainText("AED · United Arab Emirates Dirham")
  await expect(contact).toContainText("+971 54 775 7581")
  await expect(page.getByText("AED 1,250.50").first()).toBeVisible()

  // New services for this client start in AED.
  await page.goto(`${clientPath}/services/new`)
  await expect(page.locator('[aria-label="Currency"]')).toHaveText("AED")

  // 3. AED is now in use: locked, with the reason shown.
  await page.goto("/settings?tab=business")
  const aed = list.locator("li", { hasText: "AED" })
  await expect(aed).toContainText("Used by 1 client and 1 service")
  await expect(
    aed.getByRole("button", { name: /^Can’t remove AED: Used by/ })
  ).toBeDisabled()
  // KWD isn't used, so it can go again.
  await list
    .locator("li", { hasText: "KWD" })
    .getByRole("button", { name: "Remove KWD" })
    .click()
  await page.getByRole("button", { name: "Save business" }).click()
  await expect(page.getByText("Business saved")).toBeVisible()
  await expect(list.locator("li")).toHaveCount(3)
})
