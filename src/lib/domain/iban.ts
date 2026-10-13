// IBAN checks for payment accounts (Settings → Invoices). Pure.
// ISO 13616: country code, 2 check digits, then the national account number
// (BBAN); the length is fixed per country, and the whole IBAN must leave a
// remainder of 1 when taken mod 97 (with the first four characters moved to
// the end and letters as numbers, A = 10 … Z = 35).

/** Total IBAN length per country, from the SWIFT IBAN registry. */
// prettier-ignore
export const IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27,
  BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FK: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, GT: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26, IT: 27,
  JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21, LY: 25,
  MC: 27, MD: 24, ME: 22, MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28, NL: 18,
  NO: 15, OM: 23, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22, RU: 33,
  SA: 24, SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25, SV: 28,
  TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20, YE: 30,
}

/** "pk11 test 0000-0012…" → "PK11TEST00000012…": no spaces or dashes, upper case. */
export const normaliseIban = (value: string) => value.replace(/[\s-]+/g, "").toUpperCase()

/** mod 97 of the rearranged IBAN, computed in chunks (no BigInt needed). */
function mod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const digits = /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch
    for (const d of digits) remainder = (remainder * 10 + Number(d)) % 97
  }
  return remainder
}

/** Why the IBAN isn't valid, in plain words; null when it is. Empty is not checked here. */
export function ibanProblem(value: string): string | null {
  const iban = normaliseIban(value)
  if (!/^[A-Z]{2}/.test(iban))
    return "An IBAN starts with a 2-letter country code, like PK or AE."
  const country = iban.slice(0, 2)
  const length = IBAN_LENGTHS[country]
  if (!length)
    return `${country} isn’t a country that uses IBANs. Check the first two letters.`
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban))
    return "An IBAN has only letters and digits, with 2 check digits after the country code."
  if (iban.length !== length)
    return `A ${country} IBAN has ${length} characters; this one has ${iban.length}.`
  if (mod97(iban) !== 1) return "This IBAN’s check digits don’t match. Look for a typo."
  return null
}

/** Groups of four for reading aloud and printing: "PK11 TEST 0000 0012 3456 7890". */
export const formatIban = (value: string) =>
  normaliseIban(value).replace(/(.{4})(?=.)/g, "$1 ")
