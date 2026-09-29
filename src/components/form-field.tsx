import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** ids a control inside <FormField> should use for aria-describedby. */
export function fieldDescribedBy(
  id: string,
  { error, help }: { error?: string; help?: unknown }
) {
  return error ? `${id}-error` : help ? `${id}-help` : undefined
}

/**
 * Label above the control, then a 12px error (red) or help line (muted),
 * per docs/06 §3.5 and docs/12 §5. The control sets aria-invalid and
 * aria-describedby={fieldDescribedBy(id, …)} itself.
 */
export function FormField({
  id,
  label,
  required,
  help,
  error,
  className,
  children,
}: {
  id: string
  label: string
  required?: boolean
  help?: React.ReactNode
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden className="-ml-1 text-red-fg">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-fg">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-xs text-ink-muted">
          {help}
        </p>
      ) : null}
    </div>
  )
}
