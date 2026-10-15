import { spawnSync } from "node:child_process"

const result = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build", "--webpack"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=1024`.trim(),
    },
  }
)
if (result.error) console.error(result.error)
if (result.status !== 0) process.exit(result.status ?? 1)

await import("./postbuild.mjs")
