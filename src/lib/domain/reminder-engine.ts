// The reminder check's decisions (docs/04 §3–§4), kept pure so they can be
// unit-tested. lib/server/reminders.ts applies the plan in one transaction.
import { daysLeft, type ISODate } from "@/lib/domain/dates"
import { dueStage } from "@/lib/domain/stages"

export type Channel = "email" | "whatsapp"
export type Recipient = "client" | "admin"

export interface CheckSubscription {
  id: number
  domain: string
  renewalDate: ISODate
  status: "active" | "cancelled"
  remindersEnabled: boolean
  clientEmail: string | null
  /** Normalised digits, or null when there is no valid number. */
  clientPhone: string | null
}

export interface CheckConfig {
  today: ISODate
  /** Parsed stages, sorted descending (parseStages). */
  stages: readonly number[]
  postExpiryToClient: boolean
  hasAdminEmail: boolean
  hasAdminWhatsapp: boolean
}

export interface PlannedNotification {
  type: "expiring" | "expired"
  title: string
  /** "stage:{subscriptionId}:{cycle}:{stage}" — unique, so a repeat check adds nothing. */
  dedupeKey: string
}

export interface SubscriptionPlan {
  subscriptionId: number
  /** The cycle being reminded about: the subscription's current renewal date. */
  cycle: ISODate
  stage: number
  daysLeft: number
  rows: { channel: Channel; recipient: Recipient }[]
  notification: PlannedNotification
}

/** "{domain} expires in {d} days" | "… expires today" | "… expired {|d|} days ago". */
export function dueTitle(domain: string, d: number): string {
  if (d > 0) return `${domain} expires in ${d} ${d === 1 ? "day" : "days"}`
  if (d === 0) return `${domain} expires today`
  return `${domain} expired ${-d} ${d === -1 ? "day" : "days"} ago`
}

/** Rows queued for one stage (docs/04 §3.2). */
export function rowsFor(
  s: Pick<CheckSubscription, "clientEmail" | "clientPhone">,
  stage: number,
  cfg: Pick<CheckConfig, "postExpiryToClient" | "hasAdminEmail" | "hasAdminWhatsapp">
): SubscriptionPlan["rows"] {
  const rows: SubscriptionPlan["rows"] = []
  const toClient = stage >= 0 || cfg.postExpiryToClient
  if (toClient && s.clientEmail) rows.push({ channel: "email", recipient: "client" })
  if (toClient && s.clientPhone) rows.push({ channel: "whatsapp", recipient: "client" })
  if (cfg.hasAdminEmail) rows.push({ channel: "email", recipient: "admin" })
  if (cfg.hasAdminWhatsapp) rows.push({ channel: "whatsapp", recipient: "admin" })
  return rows
}

/**
 * One plan per subscription with a due stage. Subscriptions that are cancelled, have
 * reminders off or are not inside the first stage yet are left out.
 */
export function planCheck(
  subs: readonly CheckSubscription[],
  cfg: CheckConfig
): SubscriptionPlan[] {
  const plans: SubscriptionPlan[] = []
  for (const s of subs) {
    if (s.status !== "active" || !s.remindersEnabled) continue
    const d = daysLeft(s.renewalDate, cfg.today)
    const stage = dueStage(d, cfg.stages)
    if (stage === null) continue
    plans.push({
      subscriptionId: s.id,
      cycle: s.renewalDate,
      stage,
      daysLeft: d,
      rows: rowsFor(s, stage, cfg),
      notification: {
        type: d < 0 ? "expired" : "expiring",
        title: dueTitle(s.domain, d),
        dedupeKey: `stage:${s.id}:${s.renewalDate}:${stage}`,
      },
    })
  }
  return plans
}

/** The latest renewal date the check needs to look at (today + first stage). */
export function checkHorizon(stages: readonly number[]): number | null {
  return stages.length ? Math.max(...stages) : null
}

/** True when a throttled (non-forced) check should run now. */
export function checkIsDue(
  lastCheckAt: string | null,
  intervalMinutes: number,
  now: Date
): boolean {
  if (!lastCheckAt) return true
  const last = Date.parse(lastCheckAt)
  return Number.isNaN(last) || now.getTime() - last >= intervalMinutes * 60_000
}
