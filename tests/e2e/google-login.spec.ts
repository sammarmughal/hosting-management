// docs/05 §3a E2E, against the real server with a made-up Google client: the
// button, the redirect to Google (PKCE, our callback), and that a callback
// without the matching state is refused. Google's own pages aren't reached.
import { expect, test } from "@playwright/test"

test("Sign in with Google: button, redirect to Google, state check", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto("/login")
  const google = page.getByRole("link", { name: "Sign in with Google" })
  await expect(google).toHaveAttribute("href", "/api/auth/google")
  // The password form stays as the fallback.
  await expect(page.getByLabel("Username or email")).toBeVisible()

  // The start route sends the browser to Google with our callback and PKCE.
  const start = await request.get("/api/auth/google", { maxRedirects: 0 })
  expect(start.status()).toBe(303)
  const to = new URL(start.headers()["location"]!)
  expect(to.origin).toBe("https://accounts.google.com")
  expect(to.searchParams.get("client_id")).toBe(
    "e2e-test-client.apps.googleusercontent.com"
  )
  expect(to.searchParams.get("redirect_uri")).toBe(`${baseURL}/api/auth/google/callback`)
  expect(to.searchParams.get("code_challenge_method")).toBe("S256")
  expect(start.headers()["set-cookie"]).toMatch(/hrm_google_state=.*SameSite=lax/i)

  // A callback whose state doesn't match the cookie is refused, no session.
  await page.goto("/api/auth/google/callback?code=fake&state=not-the-state")
  await expect(page).toHaveURL(/\/login\?error=expired$/)
  await expect(page.getByText("That sign-in took too long. Try again.")).toBeVisible()
  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/login$/)

  // A rejected Google account comes back with the same neutral message.
  await page.goto("/login?error=invalid")
  await expect(page.getByText("Invalid credentials.")).toBeVisible()
})
