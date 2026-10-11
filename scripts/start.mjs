// `npm start`: the standalone production server (docs/11 §3), with ./.env
// loaded for local runs. On Hostinger the env vars set in hPanel are used;
// variables already set are never overridden.
try {
  process.loadEnvFile(".env")
} catch {
  // No .env: rely on the environment.
}
await import("../.next/standalone/server.js")
