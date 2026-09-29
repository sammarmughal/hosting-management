// Phase 1 stand-in for lib/server/session.ts. Mock actions call it first so
// the "every action starts with requireAdmin()" pattern is already in place
// when the real session check replaces it in Phase 3.
import { MOCK_SETTINGS } from "@/lib/mock/data"

export async function requireAdmin() {
  return { admin: { id: 1, name: MOCK_SETTINGS.adminName } }
}
