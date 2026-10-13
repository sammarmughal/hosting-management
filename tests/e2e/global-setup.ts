// Playwright global setup (docs/10 §1b, docs/13 §12): migrate and seed the
// disposable e2e database, and start a local SMTP catcher that the app sends
// to. Returns the teardown that stops the catcher.
import { execSync } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import path from "node:path"

import { E2E } from "./e2e-config"

/** Accepts any AUTH; writes each message to E2E.mailbox as one JSON line. */
function startSmtpCatcher(port: number, mailbox: string) {
  fs.mkdirSync(path.dirname(mailbox), { recursive: true })
  fs.writeFileSync(mailbox, "")
  const server = net.createServer((sock) => {
    let mode: "cmd" | "data" | "user" | "pass" = "cmd"
    let data = ""
    let rcpt: string[] = []
    let buf = ""
    const say = (s: string) => sock.write(`${s}\r\n`)
    say("220 e2e ESMTP")
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8")
      let i: number
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i)
        buf = buf.slice(i + 2)
        if (mode === "data") {
          if (line === ".") {
            fs.appendFileSync(mailbox, JSON.stringify({ rcpt, data }) + "\n")
            data = ""
            rcpt = []
            mode = "cmd"
            say("250 OK")
          } else data += line.replace(/^\.\./, ".") + "\n"
          continue
        }
        if (mode === "user") {
          mode = "pass"
          say("334 UGFzc3dvcmQ6")
          continue
        }
        if (mode === "pass") {
          mode = "cmd"
          say("235 OK")
          continue
        }
        const cmd = line.slice(0, 4).toUpperCase()
        if (cmd === "EHLO") {
          say("250-e2e")
          say("250-AUTH PLAIN LOGIN")
          say("250 8BITMIME")
        } else if (cmd === "AUTH") {
          if (/^AUTH LOGIN/i.test(line)) {
            mode = "user"
            say("334 VXNlcm5hbWU6")
          } else say("235 OK")
        } else if (cmd === "RCPT") {
          rcpt.push(line)
          say("250 OK")
        } else if (cmd === "DATA") {
          mode = "data"
          say("354 End with .")
        } else if (cmd === "QUIT") {
          say("221 Bye")
          sock.end()
        } else say("250 OK")
      }
    })
    sock.on("error", () => {})
  })
  return new Promise<net.Server>((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)))
}

export default async function globalSetup() {
  const url = E2E.databaseUrl()
  if (!url || !process.env.APP_KEY)
    throw new Error("E2E needs E2E_DATABASE_URL (or TEST_DATABASE_URL) and APP_KEY")
  const env = { ...process.env, DATABASE_URL: url }
  execSync("npx prisma migrate deploy", { stdio: "ignore", env })
  execSync("npx tsx tests/e2e/seed-e2e.ts", { stdio: "inherit", env })
  const smtp = await startSmtpCatcher(E2E.smtpPort, E2E.mailbox)
  return () => new Promise<void>((resolve) => smtp.close(() => resolve()))
}
