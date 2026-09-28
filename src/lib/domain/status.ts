// Colour / status from days left (docs/04 §2). The same function runs on
// the server and inside <TimerPill>, with thresholds from settings.
import type { Colour } from "@/types/view"

export interface Thresholds {
  /** T_o: at or below this many days the service is orange. */
  orange: number
  /** T_r: at or below this many days (and ≥ 0) the service is red. */
  red: number
}

export const DEFAULT_THRESHOLDS: Thresholds = { orange: 30, red: 7 }

export type TimeColour = Exclude<Colour, "cancelled">

export function statusColour(
  days: number,
  t: Thresholds = DEFAULT_THRESHOLDS
): TimeColour {
  if (days < 0) return "expired"
  if (days <= t.red) return "red"
  if (days <= t.orange) return "orange"
  return "green"
}

/** Cancelled services have no timer colour. */
export function serviceColour(
  days: number,
  status: "active" | "cancelled",
  t: Thresholds = DEFAULT_THRESHOLDS
): Colour {
  return status === "cancelled" ? "cancelled" : statusColour(days, t)
}

export const STATUS_LABEL: Record<Colour, string> = {
  green: "Active",
  orange: "Expiring soon",
  red: "Urgent",
  expired: "Expired",
  cancelled: "Cancelled",
}
