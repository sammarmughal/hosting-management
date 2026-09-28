import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // 16px text on mobile stops iOS zooming into the field; 14px from md up.
        "h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 py-1 text-md text-ink transition-[color,border-color,box-shadow] duration-150 ease-out outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-subtle hover:border-ink-subtle/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 md:text-base",
        className
      )}
      {...props}
    />
  )
}

export { Input }
