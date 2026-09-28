import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-md border border-input bg-surface px-3 py-2 text-md text-ink transition-[color,border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-ink-subtle hover:border-ink-subtle/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 md:text-base",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
