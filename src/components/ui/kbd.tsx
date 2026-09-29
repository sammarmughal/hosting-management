import * as React from "react"

import { cn } from "@/lib/utils"

/** A keyboard shortcut hint, e.g. <Kbd>/</Kbd>. */
function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-surface-hover px-1 font-mono text-xs leading-none text-ink-muted",
        className
      )}
      {...props}
    />
  )
}

export { Kbd }
