// docs/13 §6 E2E: enable any ISO currency from the searchable picker, give a
// client their own default currency (new subscriptions start in it,
// docs/14 §4), and a currency in use can't be removed.
import { expect, test } from "@playwright/test"

import { addDays, todayPK } from "../../src/lib/domain/dates"
import { signIn } from "./sign-in"
import { addClient, choose } from "./ui-helpers"

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

  // 2. A UAE client in AED.
  const clientPath = await addClient(page, {
    name: "Gulf Traders E2E",
    email: "accounts@gulftraders-e2e.ae",
    phone: "+971 54 775 7581",
    currency: /^AED · /,
  })
  const contact = page.locator('section[aria-labelledby="contact-title"]')
  await expect(contact).toContainText("AED · United Arab Emirates Dirham")
  await expect(contact).toContainText("+971 54 775 7581")

  // Its new subscriptions start in AED, and AED has 2 decimals.
  await page.goto(`/subscriptions/new?clientId=${clientPath.split("/").at(-1)}`)
  await expect(page.locator('[aria-label="Currency"]')).toHaveText("AED")
  await choose(page, "subscription-serviceTypeId", "Web Hosting")
  await page.fill("#subscription-domain", "gulftraders-e2e.ae")
  const today = todayPK()
  await page.fill("#subscription-startDate", addDays(today, -300))
  await page.fill("#subscription-renewalDate", addDays(today, 65))
  await page.fill("#subscription-chargeAmount", "1,250.505")
  await page.getByRole("button", { name: "Add subscription" }).click()
  await expect(page.getByText("AED amounts have at most 2 decimals")).toBeVisible()
  await page.fill("#subscription-chargeAmount", "1,250.50")
  await page.getByRole("button", { name: "Add subscription" }).click()
  await page.waitForURL(/\?tab=subscriptions&saved=subscription/)
  await expect(page.getByText("AED 1,250.50").first()).toBeVisible()

  // 3. AED is now in use: locked, with the reason shown.
  await page.goto("/settings?tab=business")
  const aed = list.locator("li", { hasText: "AED" })
  await expect(aed).toContainText("Used by 1 client and 1 subscription")
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
