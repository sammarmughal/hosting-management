// Currencies (docs/13 §6): any ISO 4217 currency, no conversion. Names and
// decimal places come from Intl, so JPY (0), PKR (0 in current CLDR) and
// KWD (3) format correctly. Pure, so forms and Server Actions share it.
import { z } from "zod"

/**
 * Active ISO 4217 currencies in circulation (October 2026). A fixed list, so
 * the server and every browser offer the same codes. Left out: withdrawn
 * codes (ANG, BGN, CUC, HRK, SLL, ZWL), fund codes and precious metals.
 */
export const ISO_CURRENCIES = [
  "AED",
  "AFN",
  "ALL",
  "AMD",
  "AOA",
  "ARS",
  "AUD",
  "AWG",
  "AZN",
  "BAM",
  "BBD",
  "BDT",
  "BHD",
  "BIF",
  "BMD",
  "BND",
  "BOB",
  "BRL",
  "BSD",
  "BTN",
  "BWP",
  "BYN",
  "BZD",
  "CAD",
  "CDF",
  "CHF",
  "CLP",
  "CNY",
  "COP",
  "CRC",
  "CUP",
  "CVE",
  "CZK",
  "DJF",
  "DKK",
  "DOP",
  "DZD",
  "EGP",
  "ERN",
  "ETB",
  "EUR",
  "FJD",
  "FKP",
  "GBP",
  "GEL",
  "GHS",
  "GIP",
  "GMD",
  "GNF",
  "GTQ",
  "GYD",
  "HKD",
  "HNL",
  "HTG",
  "HUF",
  "IDR",
  "ILS",
  "INR",
  "IQD",
  "IRR",
  "ISK",
  "JMD",
  "JOD",
  "JPY",
  "KES",
  "KGS",
  "KHR",
  "KMF",
  "KPW",
  "KRW",
  "KWD",
  "KYD",
  "KZT",
  "LAK",
  "LBP",
  "LKR",
  "LRD",
  "LSL",
  "LYD",
  "MAD",
  "MDL",
  "MGA",
  "MKD",
  "MMK",
  "MNT",
  "MOP",
  "MRU",
  "MUR",
  "MVR",
  "MWK",
  "MXN",
  "MYR",
  "MZN",
  "NAD",
  "NGN",
  "NIO",
  "NOK",
  "NPR",
  "NZD",
  "OMR",
  "PAB",
  "PEN",
  "PGK",
  "PHP",
  "PKR",
  "PLN",
  "PYG",
  "QAR",
  "RON",
  "RSD",
  "RUB",
  "RWF",
  "SAR",
  "SBD",
  "SCR",
  "SDG",
  "SEK",
  "SGD",
  "SHP",
  "SLE",
  "SOS",
  "SRD",
  "SSP",
  "STN",
  "SVC",
  "SYP",
  "SZL",
  "THB",
  "TJS",
  "TMT",
  "TND",
  "TOP",
  "TRY",
  "TTD",
  "TWD",
  "TZS",
  "UAH",
  "UGX",
  "USD",
  "UYU",
  "UZS",
  "VES",
  "VND",
  "VUV",
  "WST",
  "XAF",
  "XCD",
  "XCG",
  "XOF",
  "XPF",
  "YER",
  "ZAR",
  "ZMW",
  "ZWG",
] as const

/** Turned on for a new install (owner decision, 11 Oct 2026). */
export const DEFAULT_ENABLED_CURRENCIES = ["PKR", "USD", "AED"] as const
export const FALLBACK_CURRENCY = "PKR"

const KNOWN = new Set<string>(ISO_CURRENCIES)

export const isCurrencyCode = (v: string): boolean => KNOWN.has(v)

/** "aed " → "AED"; must be an ISO 4217 code from the list above. */
export const currencySchema = z
  .string({ message: "Choose a currency" })
  .trim()
  .toUpperCase()
  .refine(isCurrencyCode, "Choose a currency")

let names: Intl.DisplayNames | null = null
const decimalsCache = new Map<string, number>()

/** "AED" → "United Arab Emirates Dirham"; the code itself when Intl has no name. */
export function currencyName(code: string): string {
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "currency" })
    return names.of(code) ?? code
  } catch {
    return code
  }
}

/** "AED · United Arab Emirates Dirham" */
export function currencyLabel(code: string): string {
  const name = currencyName(code)
  return name === code ? code : `${code} · ${name}`
}

/** Minor-unit digits from Intl: JPY 0, USD 2, KWD 3. Always 0–3; 2 if Intl doesn't know it. */
export function currencyDecimals(code: string): number {
  const cached = decimalsCache.get(code)
  if (cached !== undefined) return cached
  let d = 2
  try {
    d =
      new Intl.NumberFormat("en", { style: "currency", currency: code }).resolvedOptions()
        .maximumFractionDigits ?? 2
  } catch {
    // Not a well-formed code: keep 2.
  }
  d = Math.min(Math.max(d, 0), 3)
  decimalsCache.set(code, d)
  return d
}

export interface CurrencyOption {
  code: string
  name: string
}

/** For pickers: every ISO currency with its English name. */
export function currencyCatalog(): CurrencyOption[] {
  return ISO_CURRENCIES.map((code) => ({ code, name: currencyName(code) }))
}

/** Unique, known, upper-case codes in alphabetical order. */
export function normaliseCurrencyList(codes: readonly string[]): string[] {
  return [...new Set(codes.map((c) => c.trim().toUpperCase()))]
    .filter(isCurrencyCode)
    .sort()
}

/**
 * Currencies a client or service form offers: the ones enabled in Settings,
 * plus the record's current one if it has since been turned off (so editing keeps it).
 */
export function currencyOptions(enabled: readonly string[], current?: string): string[] {
  return current && isCurrencyCode(current) && !enabled.includes(current)
    ? [...enabled, current].sort()
    : [...enabled]
}

/** What keeps a currency switched on, for the Settings tooltip and the action. */
export interface CurrencyUse {
  clients: number
  services: number
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`

/** "Used by 2 clients and 1 service" / null when unused. */
export function currencyUseText(use: CurrencyUse | undefined): string | null {
  if (!use || (use.clients === 0 && use.services === 0)) return null
  const parts = [
    use.clients ? plural(use.clients, "client") : "",
    use.services ? plural(use.services, "service") : "",
  ].filter(Boolean)
  return `Used by ${parts.join(" and ")}`
}

/**
 * Null when `enabled` keeps every currency in use switched on, else why not:
 * "AED is used by 2 clients and 1 service, so it can't be turned off."
 */
export function currencyInUseError(
  enabled: readonly string[],
  usage: Readonly<Record<string, CurrencyUse>>
): string | null {
  for (const code of Object.keys(usage).sort()) {
    const text = currencyUseText(usage[code])
    if (text && !enabled.includes(code))
      return `${code} is ${text.charAt(0).toLowerCase()}${text.slice(1)}, so it can’t be turned off.`
  }
  return null
}
