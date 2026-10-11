// docs/03 §4: Prisma maps @db.Date to a JS Date at UTC midnight. Convert at
// the boundary; everything else sees 'YYYY-MM-DD' strings. (Not
// server-only: pure, and used by the seed script and tests too.)
import type { ISODate } from "@/lib/domain/dates"

export const toDbDate = (d: ISODate): Date => new Date(`${d}T00:00:00.000Z`)
export const fromDbDate = (d: Date): ISODate => d.toISOString().slice(0, 10)
