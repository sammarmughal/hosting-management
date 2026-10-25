// Adding records through the UI (docs/14): a client first, then companies
// and subscriptions from the client's page.
import { expect, type Page } from "@playwright/test"

/** Picks an option in a Radix Select by its trigger id. */
export async function choose(page: Page, triggerId: string, option: string | RegExp) {
  await page.locator(`#${triggerId}`).click()
  await page.getByRole("option", { name: option }).click()
}

/** Adds a client and returns its page path, e.g. "/clients/3". */
export async function addClient(
  page: Page,
  c: { name: string; email?: string; phone?: string; currency?: RegExp }
) {
  await page.goto("/clients/new")
  await page.fill("#client-name", c.name)
  if (c.email) await page.fill("#client-email", c.email)
  if (c.phone) await page.fill("#client-phone", c.phone)
  if (c.currency) await choose(page, "client-currency", c.currency)
  await page.getByRole("button", { name: "Save client" }).click()
  await page.waitForURL(/\/clients\/\d+\?saved=client/)
  return new URL(page.url()).pathname
}

/** Adds a company from the client's page. */
export async function addCompany(
  page: Page,
  clientPath: string,
  co: { name: string; email?: string; address?: string }
) {
  await page.goto(`${clientPath}?tab=companies`)
  await page.getByRole("link", { name: "Add company" }).click()
  await page.waitForURL(/\/companies\/new\?/)
  await page.fill("#company-name", co.name)
  if (co.email) await page.fill("#company-email", co.email)
  if (co.address) await page.fill("#company-address", co.address)
  await page.getByRole("button", { name: "Save company" }).click()
  await page.waitForURL(/\?tab=companies&saved=company/)
}

/** Adds a subscription for the client (and company), from /subscriptions/new. */
export async function addSubscription(
  page: Page,
  clientPath: string,
  s: {
    service?: string
    company?: string
    domain: string
    start: string
    renewal: string
    charge: string
  }
) {
  const clientId = clientPath.split("/").at(-1)
  await page.goto(`/subscriptions/new?clientId=${clientId}`)
  if (s.company) await choose(page, "subscription-companyId", s.company)
  await choose(page, "subscription-serviceTypeId", s.service ?? "Web Hosting")
  await page.fill("#subscription-domain", s.domain)
  await page.fill("#subscription-startDate", s.start)
  await page.fill("#subscription-renewalDate", s.renewal)
  await page.fill("#subscription-chargeAmount", s.charge)
  await page.getByRole("button", { name: "Add subscription" }).click()
  await page.waitForURL(/\?tab=subscriptions&saved=subscription/)
  await expect(page.getByRole("heading", { name: s.domain })).toBeVisible()
}
