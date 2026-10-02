import { INITIAL_PREFERENCES, type Preferences } from "@/lib/domain/preferences"

const globalStore = globalThis as typeof globalThis & { renewalPreferences?: Preferences }
export function preferences(): Preferences {
  return (globalStore.renewalPreferences ??= structuredClone(INITIAL_PREFERENCES))
}
