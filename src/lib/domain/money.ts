// Money helpers. Amounts arrive as decimal strings (Prisma Decimal) and are
// handled as integer thousandths ("units"), never JS floats. Three digits
// cover every currency's minor unit (KWD has 3); how many are shown comes
// from the currency (currency.ts), e.g. "PKR 6,500", "USD 49.99", "KWD 12.500".
import { currencyDecimals } from "@/lib/domain/currency"

/** Digits stored after the point (DB columns are DECIMAL(15,3)). */
export const MONEY_SCALE = 3
const ONE = 1000n

const AMOUNT_RE = /^(-)?(\d+)(?:\.(\d+))?$/

/** "6500.5055" → 6500506n (half-up to thousandths). Throws on anything else. */
export function toUnits(amount: string): bigint {
  const m = AMOUNT_RE.exec(amount.trim())
  if (!m) throw new RangeError(`Invalid amount: ${amount}`)
  const [, sign, int = "0", frac = ""] = m
  let units = BigInt(int) * ONE + BigInt((frac + "000").slice(0, MONEY_SCALE))
  if (Number(frac[MONEY_SCALE] ?? "0") >= 5) units += 1n
  return sign && units !== 0n ? -units : units
}

/** 6500500n → "6500.500" (the DB format). */
export function fromUnits(units: bigint): string {
  const neg = units < 0n
  const abs = neg ? -units : units
  return `${neg ? "-" : ""}${abs / ONE}.${String(abs % ONE).padStart(MONEY_SCALE, "0")}`
}

const pow10 = (n: number) => 10n ** BigInt(n)

/** Rounds half away from zero to `decimals` (0–3) places, still in units. */
export function roundUnits(units: bigint, decimals: number): bigint {
  const step = pow10(MONEY_SCALE - decimals)
  const neg = units < 0n
  const abs = neg ? -units : units
  const rounded = ((abs + step / 2n) / step) * step
  return neg ? -rounded : rounded
}

/** Digits after the point that aren't trailing zeros: 6500.500 → 1. */
function usedDecimals(units: bigint): number {
  let rest = (units < 0n ? -units : units) % ONE
  if (rest === 0n) return 0
  let digits = MONEY_SCALE
  while (rest % 10n === 0n) {
    rest /= 10n
    digits--
  }
  return digits
}

/**
 * Fraction digits to show: the currency's. A value with more (saved before
 * the currency's digits applied, e.g. PKR 4750.50) is shown in full, never rounded away.
 */
function shownDecimals(units: bigint, currency?: string): number {
  const decimals = currency ? currencyDecimals(currency) : 2
  const used = usedDecimals(units)
  return used > decimals ? Math.max(used, 2) : decimals
}

function digitsOf(units: bigint, decimals: number) {
  const neg = units < 0n
  const abs = neg ? -units : units
  const scaled = abs / pow10(MONEY_SCALE - decimals)
  const whole = scaled / pow10(decimals)
  const frac = decimals ? String(scaled % pow10(decimals)).padStart(decimals, "0") : ""
  return { neg, whole, frac }
}

/**
 * "6500.000" → "6,500"; "6500.5" in USD → "6,500.50"; "12.5" in KWD → "12.500".
 * No decimals when the fraction is zero. Without a currency, two decimals.
 */
export function formatAmount(amount: string, currency?: string): string {
  const units = toUnits(amount)
  const { neg, whole, frac } = digitsOf(units, shownDecimals(units, currency))
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  return `${neg ? "-" : ""}${grouped}${/^0*$/.test(frac) ? "" : `.${frac}`}`
}

/** ("6500.00", "PKR") → "PKR 6,500" */
export function formatMoney(amount: string, currency: string): string {
  return `${currency} ${formatAmount(amount, currency)}`
}

/** Plain decimal with the currency's digits, for CSV: "6500", "49.99", "12.500". */
export function plainAmount(amount: string, currency: string): string {
  const units = toUnits(amount)
  const { neg, whole, frac } = digitsOf(units, shownDecimals(units, currency))
  return `${neg ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`
}

/** Exact decimal sum of amount strings, e.g. for per-currency totals. */
export function sumAmounts(amounts: readonly string[]): string {
  return fromUnits(amounts.reduce((sum, a) => sum + toUnits(a), 0n))
}

export interface CurrencyTotal {
  currency: string
  total: string
}

/**
 * One total per currency; different currencies are never added together.
 * `first` (the default currency) leads, the rest follow alphabetically.
 */
export function totalsByCurrency(
  rows: readonly { currency: string; amount: string }[],
  first?: string
): CurrencyTotal[] {
  const groups = new Map<string, bigint>()
  for (const r of rows)
    groups.set(r.currency, (groups.get(r.currency) ?? 0n) + toUnits(r.amount))
  return [...groups]
    .map(([currency, units]) => ({ currency, total: fromUnits(units) }))
    .sort(
      (a, b) =>
        Number(b.currency === first) - Number(a.currency === first) ||
        a.currency.localeCompare(b.currency)
    )
}
