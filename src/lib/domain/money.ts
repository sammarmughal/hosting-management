// Money helpers. Amounts arrive as decimal strings (Prisma Decimal
// .toString()) and are handled as integer cents, never JS floats.

const AMOUNT_RE = /^(-)?(\d+)(?:\.(\d+))?$/

/** "6500.505" → 650051n (half-up to cents). Throws on anything else. */
export function toCents(amount: string): bigint {
  const m = AMOUNT_RE.exec(amount.trim())
  if (!m) throw new RangeError(`Invalid amount: ${amount}`)
  const [, sign, int = "0", frac = ""] = m
  let cents = BigInt(int) * 100n + BigInt((frac + "00").slice(0, 2))
  if (Number(frac[2] ?? "0") >= 5) cents += 1n
  return sign && cents !== 0n ? -cents : cents
}

/** 650050n → "6500.50" */
export function fromCents(cents: bigint): string {
  const neg = cents < 0n
  const abs = neg ? -cents : cents
  const frac = String(abs % 100n).padStart(2, "0")
  return `${neg ? "-" : ""}${abs / 100n}.${frac}`
}

/** "6500.00" → "6,500"; "6500.5" → "6,500.50". No decimals when .00. */
export function formatAmount(amount: string): string {
  const cents = toCents(amount)
  const neg = cents < 0n
  const abs = neg ? -cents : cents
  const whole = String(abs / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const rest = abs % 100n
  const frac = rest === 0n ? "" : `.${String(rest).padStart(2, "0")}`
  return `${neg ? "-" : ""}${whole}${frac}`
}

/** ("6500.00", "PKR") → "PKR 6,500" */
export function formatMoney(amount: string, currency: string): string {
  return `${currency} ${formatAmount(amount)}`
}

/** Exact decimal sum of amount strings, e.g. for per-currency totals. */
export function sumAmounts(amounts: readonly string[]): string {
  return fromCents(amounts.reduce((sum, a) => sum + toCents(a), 0n))
}
