import type { Page } from "@playwright/test"
import { generate } from "otplib"

import { E2E } from "./e2e-config"

/**
 * Password + TOTP sign-in as the e2e admin. A code can be used once (replay
 * guard), so a second sign-in in the same 30 s step waits for the next one.
 */
export async function signIn(page: Page) {
  await page.goto("/login")
  await page.fill("#identifier", E2E.username)
  await page.fill("#password", E2E.password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL(/\/2fa$/)
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt) await page.waitForTimeout(31_000 - (Date.now() % 30_000))
    const input = page.locator('input[inputmode="numeric"]').first()
    await input.click()
    for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace")
    await page.keyboard.type(await generate({ secret: E2E.totpSecret }))
    await page.getByRole("button", { name: "Verify" }).click()
    try {
      await page.waitForURL(/\/dashboard$/, { timeout: 10_000 })
      return
    } catch {
      // Same step as the previous sign-in: try the next code.
    }
  }
  throw new Error("Couldn't sign in with the e2e TOTP secret")
}
