// WhatsApp click-to-chat helpers (docs/08 §4). No API: just wa.me links.

/** Pakistan. Could become a setting later. */
export const DEFAULT_COUNTRY_CODE = "92"

/** Very long URLs can fail on some phones (docs/08 §4). */
export const MAX_MESSAGE_LENGTH = 1500

/**
 * Normalises a phone number to the digits wa.me expects: country code,
 * no "+". Returns null when the result is not 10–15 digits.
 */
export function normalisePhone(input: string | null | undefined): string | null {
  if (!input) return null
  let s = input.trim().replace(/[\s\-().]/g, "")
  if (s === "") return null

  if (s.startsWith("+")) {
    s = s.slice(1)
  } else if (s.startsWith("00")) {
    s = s.slice(2)
  } else if (/^0\d{10}$/.test(s)) {
    s = DEFAULT_COUNTRY_CODE + s.slice(1) // 03001234567
  } else if (/^3\d{9}$/.test(s)) {
    s = DEFAULT_COUNTRY_CODE + s // 3001234567 (PK mobile)
  } else if (s.startsWith("0")) {
    return null // a single leading 0 is a local number we can't place
  }

  return /^\d{10,15}$/.test(s) ? s : null
}

/** "923001234567" → "+92 300 1234567". Other countries: "+" + digits. */
export function formatPhone(digits: string): string {
  const pk = /^92(\d{3})(\d{7})$/.exec(digits)
  if (pk) return `+92 ${pk[1]} ${pk[2]}`
  return `+${digits}`
}

/** https://wa.me/<digits>?text=<encoded message>; no text → plain chat link. */
export function buildWaLink(digits: string, message?: string): string {
  const base = `https://wa.me/${digits}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
