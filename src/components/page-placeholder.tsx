// Phase 1 stand-in for screens that are built in later steps.
export function PagePlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-5 sm:px-5">
      <p className="text-base font-medium text-ink">Coming in a later step</p>
      <p className="mt-1 max-w-prose text-sm text-ink-muted">{children}</p>
    </div>
  )
}
