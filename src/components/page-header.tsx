import { cn } from "@/lib/utils"

/**
 * The page's own H1 on detail and edit pages (the topbar shows the
 * breadcrumb there). 22/28 semibold per docs/12 §2, with an optional
 * description line and actions on the right.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-[-0.01em] break-words text-ink">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
