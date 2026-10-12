// The business's own mark when there's no logo: initials from the business
// name ("Abdul Rehmaan" → "AR"). Pure.

/** Words that start with a letter: "Sheikh & Sons (Pvt) Ltd" → Sheikh, Sons, Pvt, Ltd. */
const WORD = /\p{L}[\p{L}\p{M}'’.-]*/gu

/**
 * Up to two initials: the first letters of the first two words, or the first
 * two letters of a one-word name. "" when the name has no letters.
 */
export function brandInitials(businessName: string): string {
  const words = businessName.match(WORD) ?? []
  const [first, second] = words
  if (!first) return ""
  const letters = second
    ? [...first][0]! + [...second][0]!
    : [...first].slice(0, 2).join("")
  return letters.toLocaleUpperCase("en")
}

/** data:image/png;base64,… → { type, bytes }, or null. */
export function parseLogoDataUrl(
  logo: string
): { type: "image/png" | "image/jpeg"; base64: string } | null {
  const m = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo)
  return m ? { type: m[1] as "image/png" | "image/jpeg", base64: m[2]! } : null
}
