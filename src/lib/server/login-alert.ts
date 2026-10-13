import "server-only"

import { sendMail } from "@/lib/server/mail"
import { getAppSettings } from "@/lib/server/settings"
import { failuresLastHour, LIMITS } from "@/lib/server/throttle"

/**
 * Emails the admin once when failed sign-ins (password, 2FA or Google) reach
 * 10 in an hour (docs/05 §4). Never throws: the sign-in answer comes first.
 */
export async function alertOnUnusualActivity() {
  if ((await failuresLastHour()) !== LIMITS.alertPerHour) return
  try {
    const s = await getAppSettings()
    if (!s.adminEmail) return
    await sendMail(s, {
      to: s.adminEmail,
      subject: "Unusual login activity on Renewals",
      html: `<p>There were ${LIMITS.alertPerHour} failed sign-in attempts in the last hour.</p><p>If this wasn't you, nothing is needed: the attempts are being blocked. Consider changing your password.</p>`,
      text: `There were ${LIMITS.alertPerHour} failed sign-in attempts in the last hour. If this wasn't you, consider changing your password.`,
    })
  } catch (err) {
    console.error("unusual activity alert failed", err)
  }
}
