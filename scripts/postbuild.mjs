// docs/11 §3: with `output: "standalone"`, the server in .next/standalone
// needs public/ and .next/static next to it. Runs after `next build`.
//
// `next build` also copies .env* into .next/standalone. Those hold local
// secrets (APP_KEY, database password), so they are removed: zipping or
// uploading the standalone folder must never ship them. Hosts set the env
// vars in their panel; locally, `npm start` loads ./.env (scripts/start.mjs).
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs"

const out = ".next/standalone"
if (existsSync(out)) {
  cpSync("public", `${out}/public`, { recursive: true })
  cpSync(".next/static", `${out}/.next/static`, { recursive: true })
  const removed = readdirSync(out).filter((f) => /^\.env/.test(f) && f !== ".env.example")
  for (const f of removed) rmSync(`${out}/${f}`)
  console.log(
    `postbuild: copied public/ and .next/static into ${out}` +
      (removed.length ? `; removed ${removed.join(", ")} from the build output` : "")
  )
}
