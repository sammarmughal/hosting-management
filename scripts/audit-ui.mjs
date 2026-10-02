import { mkdir, readFile, writeFile } from "node:fs/promises"
import { chromium } from "@playwright/test"

export const routes = [
  ["home", "/"], ["dashboard", "/dashboard"], ["clients", "/clients"],
  ["clients-new", "/clients/new"], ["client-detail", "/clients/1"],
  ["client-long-name", "/clients/5"], ["client-edit", "/clients/1/edit"],
  ["service-new", "/clients/1/services/new"], ["service-edit", "/services/101/edit"],
  ["client-reminder-log", "/clients/1?tab=log"], ["client-activity", "/clients/1?tab=activity"],
  ["reminders", "/reminders"], ["reminder-log", "/reminders?tab=log"],
  ["payments", "/payments"], ["notifications", "/notifications"], ["import", "/import"],
  ["settings-business", "/settings"], ["settings-reminders", "/settings?tab=reminders"],
  ["settings-email", "/settings?tab=email"], ["settings-templates", "/settings?tab=templates"],
  ["settings-security", "/settings?tab=security"], ["login", "/login"], ["2fa", "/2fa"],
  ["2fa-setup", "/2fa/setup"], ["forgot", "/forgot"], ["reset", "/reset/preview"],
  ["403", "/403"], ["419", "/419"], ["500", "/500", 500],
  ["404", "/missing-page", 404], ["styleguide", "/styleguide", process.env.AUDIT_DEV ? 200 : 404],
]
const base = process.env.BASE_URL ?? "http://localhost:3001"
const pass = process.env.AUDIT_PASS ?? "before"
const out = `screenshots/audit/${pass}`
const widths = [360, 390, 768, 1024, 1440]
const browser = await chromium.launch()
await mkdir(out, { recursive: true })
const selectedNames = process.env.AUDIT_ROUTES?.split(",")
const manifest = selectedNames
  ? JSON.parse(await readFile(`${out}/manifest.json`, "utf8").catch(() => "[]")).filter(e => !selectedNames.includes(e.name))
  : []
try {
  for (const [name, route, expected = 200] of routes.filter(([name]) => !process.env.AUDIT_ROUTES || process.env.AUDIT_ROUTES.split(",").includes(name))) {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce", hasTouch: width < 1024 })
      const page = await context.newPage()
      const errors = []
      page.on("pageerror", (e) => errors.push(e.message))
      page.on("console", (m) => {
        if (m.type() !== "error" && !/hydrat/i.test(m.text())) return
        if (expected >= 400 && m.location().url === base + route && m.text().includes(String(expected))) return
        errors.push(m.text())
      })
      const response = await page.goto(base + route, { waitUntil: "networkidle" })
      await page.evaluate(() => document.fonts.ready)
      for (const frame of await page.locator("iframe").all()) { await frame.scrollIntoViewIfNeeded(); await page.waitForTimeout(100) }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(650)
      const metrics = await page.evaluate(() => ({
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight, title: document.title,
        headings: [...document.querySelectorAll("h1,h2,h3")].filter((e) => e.getBoundingClientRect().height).map((e) => ({ text: e.textContent, size: getComputedStyle(e).fontSize })),
        smallTargets: [...document.querySelectorAll("button,a,input,select,[role=checkbox],[role=switch]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[aria-hidden=true]') && (r.width < 44 || r.height < 44) }).map((e) => ({ text: (e.getAttribute("aria-label") || e.textContent || e.getAttribute("name") || e.tagName).slice(0,70), width: Math.round(e.getBoundingClientRect().width), height: Math.round(e.getBoundingClientRect().height) })),
      }))
      const file = `${name}-${width}.png`
      await page.screenshot({ caret: "initial", path: `${out}/${file}`, fullPage: true, animations: "disabled" })
      const entry = { name, route, file, width, status: response?.status(), expected, errors, ...metrics }
      manifest.push(entry)
      if (errors.length || metrics.scrollWidth > width || response?.status() !== expected) console.log("ISSUE", name, width, JSON.stringify({ errors, overflow: metrics.scrollWidth-width, status: response?.status() }))
      await context.close()
    }
    console.log(`Captured ${name}: all five widths`)
    await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2))
  }
  await writeFile(`${out}/index.html`, `<!doctype html><meta charset="utf-8"><title>UI audit · ${pass}</title><style>body{font:14px system-ui;background:#f7f8fa;color:#111827;padding:24px}section{margin-bottom:32px}h2{font-size:18px}div{display:flex;gap:16px;align-items:start}figure{margin:0;flex:1;min-width:0}img{width:100%;border:1px solid #e6e8ec}a{color:#1f4e79}</style><h1>UI audit · ${pass}</h1>${routes.map(([name,route])=>`<section><h2>${route}</h2><div>${widths.map(width=>`<figure><figcaption>${width}px</figcaption><a href="${name}-${width}.png"><img src="${name}-${width}.png"></a></figure>`).join("")}</div></section>`).join("")}`)
  const failures = manifest.filter(e => e.errors.length || e.scrollWidth > e.width || e.status !== e.expected)
  console.log(`Done: ${manifest.length} screenshots; ${failures.length} failures. ${out}/index.html`)
  if (failures.length) process.exitCode = 1
} finally { await browser.close() }
