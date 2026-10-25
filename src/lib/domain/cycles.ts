// Billing cycles (docs/14 §1). Everything is yearly for now; renewing, the
// invoice period and the form's default renewal date all go through here, so
// another cycle later is one more value and one more case.
import { addOneYear, type ISODate } from "@/lib/domain/dates"

export type BillingCycle = "yearly"

export const DEFAULT_CYCLE: BillingCycle = "yearly"

/** The renewal date one cycle after `date` (29 Feb → 28 Feb for yearly). */
export function nextRenewal(date: ISODate, cycle: BillingCycle = DEFAULT_CYCLE): ISODate {
  switch (cycle) {
    case "yearly":
      return addOneYear(date)
  }
}
