import { AppShell } from "@/components/layout/app-shell"
import { SettingsProvider } from "@/components/settings-provider"
import { getSettings, getShellSummary } from "@/lib/data"
import { requireAdmin } from "@/lib/server/session"

// Every (app) page is dynamic (docs/07 §1): data and "today" change per request.
export const dynamic = "force-dynamic"

// The real check is here AND in every Server Action and route handler
// (docs/05 §2); proxy.ts only redirects when there's no cookie at all.
export default async function AppLayout({
  children,
  crumbs,
}: {
  children: React.ReactNode
  /** @crumbs slot: the topbar breadcrumb for detail and edit pages. */
  crumbs: React.ReactNode
}) {
  await requireAdmin()
  const [settings, summary] = await Promise.all([getSettings(), getShellSummary()])

  return (
    <SettingsProvider thresholds={settings.thresholds}>
      <AppShell summary={summary} crumbs={crumbs}>
        {children}
      </AppShell>
    </SettingsProvider>
  )
}
