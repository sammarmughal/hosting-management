// npm run db:local:start | db:local:stop | db:local:status   (README → Local database)
//
// A portable MariaDB for machines without Docker (no admin rights needed).
// Binaries: the official Windows ZIP unpacked to %LOCALAPPDATA%\mariadb-11.8
// (or MARIADB_HOME). Data: .local-db/ in this project (git-ignored).
// The first start creates the data folder and runs docker/mariadb-init.sql,
// so the databases and the hrm/hrm user are the same as with Docker.
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdirSync, openSync, readFileSync } from "node:fs"
import net from "node:net"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const HOME =
  process.env.MARIADB_HOME || path.join(process.env.LOCALAPPDATA || "", "mariadb-11.8")
const BIN = (name) =>
  path.join(HOME, "bin", process.platform === "win32" ? `${name}.exe` : name)
const DIR = path.join(ROOT, ".local-db")
const DATA = path.join(DIR, "data")
const LOG = path.join(DIR, "server.log")
const PORT = 3306
// Local only: the root password of this throwaway development server.
const ROOT_ENV = { ...process.env, MYSQL_PWD: "root" }
// Local TCP only: no TLS certificate to verify (silences the client warning).
const CLIENT_ARGS = [
  "-uroot",
  `--port=${PORT}`,
  "--protocol=TCP",
  "--skip-ssl-verify-server-cert",
]

function fail(message) {
  console.error(message)
  process.exit(1)
}

const portOpen = () =>
  new Promise((resolve) => {
    const s = net.connect(PORT, "127.0.0.1")
    s.once("connect", () => (s.destroy(), resolve(true)))
    s.once("error", () => resolve(false))
  })

const ping = () =>
  spawnSync(BIN("mariadb-admin"), [...CLIENT_ARGS, "ping"], {
    env: ROOT_ENV,
    encoding: "utf8",
  }).status === 0

async function waitUntil(check, what, ms = 30_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await check()) return
    await new Promise((r) => setTimeout(r, 300))
  }
  fail(`Timed out waiting for ${what}. See ${LOG}.`)
}

function initialise() {
  console.log(`Creating the data folder in ${DATA}…`)
  mkdirSync(DIR, { recursive: true })
  const r = spawnSync(
    BIN("mariadb-install-db"),
    [`--datadir=${DATA}`, "--password=root", `--port=${PORT}`],
    { stdio: "inherit" }
  )
  if (r.status !== 0) fail("mariadb-install-db failed.")
}

async function start() {
  if (!existsSync(BIN("mariadbd")))
    fail(
      `MariaDB not found in ${HOME}. Unzip the MariaDB 11.8 Windows ZIP there, or set MARIADB_HOME.`
    )
  if (await portOpen()) {
    if (ping()) return console.log(`MariaDB is already running on port ${PORT}.`)
    fail(`Port ${PORT} is in use by something else (Docker's database?).`)
  }
  const fresh = !existsSync(DATA)
  if (fresh) initialise()
  const out = openSync(LOG, "a")
  const child = spawn(
    BIN("mariadbd"),
    [
      `--defaults-file=${path.join(DATA, "my.ini")}`,
      `--datadir=${DATA}`,
      `--port=${PORT}`,
      "--bind-address=127.0.0.1",
      "--character-set-server=utf8mb4",
      "--collation-server=utf8mb4_unicode_ci",
      // On purpose not UTC, like a server clock in Pakistan time: the tests
      // prove the app still stores and reads UTC (src/lib/db-config.ts).
      "--default-time-zone=+05:00",
    ],
    { detached: true, stdio: ["ignore", out, out], windowsHide: true }
  )
  child.unref()
  await waitUntil(async () => (await portOpen()) && ping(), "MariaDB to start")
  if (fresh) {
    const sql = readFileSync(path.join(ROOT, "docker", "mariadb-init.sql"), "utf8")
    const r = spawnSync(BIN("mariadb"), CLIENT_ARGS, {
      input: sql,
      env: ROOT_ENV,
      stdio: ["pipe", "inherit", "inherit"],
    })
    if (r.status !== 0) fail("Running docker/mariadb-init.sql failed.")
    console.log("Created the databases hrm, hrm_test and hrm_e2e and the user hrm/hrm.")
  }
  console.log(`MariaDB is running on port ${PORT} (log: ${LOG}).`)
}

async function stop() {
  if (!(await portOpen())) return console.log("MariaDB is not running.")
  const r = spawnSync(BIN("mariadb-admin"), [...CLIENT_ARGS, "shutdown"], {
    env: ROOT_ENV,
    stdio: "inherit",
  })
  if (r.status !== 0) fail("Shutdown failed.")
  await waitUntil(async () => !(await portOpen()), "MariaDB to stop")
  console.log("MariaDB stopped.")
}

async function status() {
  console.log((await portOpen()) && ping() ? `Running on port ${PORT}.` : "Not running.")
}

const commands = { start, stop, status }
const cmd = commands[process.argv[2]]
if (!cmd) fail("Usage: node scripts/local-db.mjs start|stop|status")
await cmd()
