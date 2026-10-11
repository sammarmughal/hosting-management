// Runs before every test file. Tests never touch the dev database: server
// modules read DATABASE_URL, so it is pointed at TEST_DATABASE_URL here.
try {
  process.loadEnvFile(".env")
} catch {
  // CI: variables come from the environment.
}
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
else delete process.env.DATABASE_URL

// Mail goes to nodemailer's jsonTransport unless a test opts into SMTP.
process.env.MAIL_TRANSPORT = "json"
process.env.FAKE_TODAY = ""
process.env.APP_KEY ||= `base64:${Buffer.alloc(32, 7).toString("base64")}`
