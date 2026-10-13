// docs/13 §11 E2E: Settings → Invoices → Payment accounts. A currency on one
// account can't be picked on another (and the form says why), a bad IBAN is
// explained, and a valid change saves.
import { expect, test } from "@playwright/test"

import { signIn } from "./sign-in"

test("payment accounts: one account per currency, IBAN check, save", async ({ page }) => {
  await signIn(page)
  await page.goto("/settings?tab=invoices")

  const pk = page.getByRole("region", { name: "Pakistan account" })
  const uae = page.getByRole("region", { name: "UAE account" })
  await expect(pk.getByText("Default", { exact: true })).toBeVisible()

  // PKR is on the Pakistan account, so the UAE account can't take it.
  const pkrOnUae = uae.getByRole("button", { name: /PKR/ })
  await expect(pkrOnUae).toBeDisabled()
  await expect(pkrOnUae).toContainText("on Pakistan account")
  await expect(uae.getByText(/A currency can belong to only one account/)).toBeVisible()

  // A typo in the IBAN is explained, and saving is refused.
  const iban = uae.getByLabel("IBAN")
  await iban.fill("AE09 0000 0000 0123 4567 891")
  await expect(
    uae.getByText("This IBAN’s check digits don’t match. Look for a typo.")
  ).toBeVisible()
  await page.getByRole("button", { name: "Save invoices" }).click()
  await expect(
    page.getByText(/UAE account: This IBAN’s check digits don’t match/)
  ).toBeVisible()

  // Fixed, and USD moved to the UAE account: saved and kept after a reload.
  await iban.fill("AE09 0000 0000 0123 4567 890")
  await uae.getByRole("button", { name: "USD" }).click()
  await expect(uae.getByRole("button", { name: "USD" })).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await expect(pk.getByRole("button", { name: /USD/ })).toBeDisabled()
  await page.getByRole("button", { name: "Save invoices" }).click()
  await expect(page.getByText("Invoices saved")).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole("region", { name: "UAE account" }).getByRole("button", { name: "USD" })
  ).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByText("AED, USD → UAE account")).toBeVisible()
})
