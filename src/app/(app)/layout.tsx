import { AppShell } from "@/components/layout/app-shell"
import { SettingsProvider } from "@/components/settings-provider"
import { getSettings, getShellSummary } from "@/lib/data"

// Every (app) page is dynamic (docs/07 §1): data and "today" change per request.
export const dynamic = "force-dynamic"

// Phase 1: no auth yet. Phase 3 adds `await requireAdmin()` here (and in
// every action), per docs/05 §2.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [settings, summary] = await Promise.all([getSettings(), getShellSummary()])

  return (
    <SettingsProvider thresholds={settings.thresholds}>
      <AppShell summary={summary}>{children}</AppShell>
    </SettingsProvider>
  )
}
