// Pre-launch checks: the public health endpoint and the weekly CSV backup
// (Settings → Backup, docs/11 §6).
import { expect, test } from "@playwright/test"

import { signIn } from "./sign-in"

test("health is public and data-free; Settings → Backup downloads five CSVs", async ({
  page,
  request,
}) => {
  const health = await request.get("/api/health")
  expect(health.status()).toBe(200)
  expect(await health.json()).toEqual({ status: "ok", db: "ok" })

  // Exports need a session.
  const anon = await request.get("/api/export/clients", { maxRedirects: 0 })
  expect(anon.status()).not.toBe(200)

  await signIn(page)
  await page.goto("/settings?tab=backup")
  await expect(page.getByRole("heading", { name: "Backup" })).toBeVisible()
  for (const [name, file, header] of [
    ["clients", "clients", "name,email,phone,address,currency,notes"],
    ["companies", "companies", "client_name,client_email,client_phone,company_name"],
    [
      "subscriptions",
      "subscriptions",
      "client_name,client_email,client_phone,company_name,service_type,domain",
    ],
    [
      "payments",
      "payments",
      "paid_on,client_name,company,service_type,domain,amount,currency",
    ],
    ["invoices", "invoices", "number,issue_date,due_date,client_name"],
  ] as const) {
    const download = page.waitForEvent("download")
    await page.getByRole("link", { name: `Download ${name} CSV` }).click()
    const d = await download
    expect(d.suggestedFilename()).toMatch(
      new RegExp(`^${file}-\\d{4}-\\d{2}-\\d{2}\\.csv$`)
    )
    const text = (await (await d.createReadStream()).toArray()).join("")
    expect(text.replace(/^﻿/, "").startsWith(header)).toBe(true)
  }
})
