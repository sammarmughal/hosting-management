// Reminder stages (docs/04 §3). A stage is the "days left" at which a
// reminder becomes due; negative stages are after expiry.

export const DEFAULT_STAGES = "30,15,7,3,1,0,-3,-6,-9"

/** Parses "30,15,7" (or a number list) into unique integers, sorted descending. */
export function parseStages(input: string | readonly number[]): number[] {
  const raw =
    typeof input === "string"
      ? input
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "")
          .map(Number)
      : [...input]
  const valid = raw.filter((n) => Number.isInteger(n))
  return [...new Set(valid)].sort((a, b) => b - a)
}

/** 7 → "7 days before expiry", 0 → "Expiry day", −3 → "3 days after expiry". */
export function stageLabel(stage: number): string {
  if (stage === 0) return "Expiry day"
  const n = Math.abs(stage)
  const days = `${n} ${n === 1 ? "day" : "days"}`
  return stage > 0 ? `${days} before expiry` : `${days} after expiry`
}

/**
 * dueStage(d) = MIN { s ∈ stages : d ≤ s }, or null.
 * This also gives catch-up: if the app wasn't opened for a while, only the
 * latest stage is due, so older reminders are never sent late.
 */
export function dueStage(d: number, stages: readonly number[]): number | null {
  let due: number | null = null
  for (const s of stages) {
    if (d <= s && (due === null || s < due)) due = s
  }
  return due
}
