// Runs once when a server instance starts. In production it refuses to run
// with an APP_URL that would put wrong links in invoices and emails
// (missing, http, or localhost). See docs/11 §2.
//
// ALLOW_LOCAL_APP_URL=1 lets the production build run on this machine
// (`npm start`, the Playwright tests). Never set it on Vercel or Hostinger.
import { appUrlProblem } from "@/lib/domain/app-url"

export function register() {
  if (process.env.NODE_ENV !== "production") return
  // `next build` also loads the app; the check is for running servers only.
  if (process.env.NEXT_PHASE === "phase-production-build") return
  if (process.env.ALLOW_LOCAL_APP_URL === "1") return
  const problem = appUrlProblem(process.env.APP_URL)
  if (problem) {
    const message = `Refusing to start: ${problem}. Set APP_URL to the public https URL (docs/11 §2).`
    console.error(message)
    throw new Error(message)
  }
}
