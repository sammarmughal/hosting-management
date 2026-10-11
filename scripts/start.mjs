// `npm start`: the standalone production server (docs/11 §3), with ./.env
// loaded for local runs. On Vercel/Hostinger the host's env vars are used;
// variables already set are never overridden.
try {
  process.loadEnvFile(".env")
} catch {
  // No .env: rely on the environment.
}
await import("../.next/standalone/server.js")
