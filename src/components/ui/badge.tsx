import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

// Same family as the timer pill (docs/12 §5): 24px, light tint, no
// border, sans text. Status variants pair with a .status-dot.
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full px-2 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        neutral: "bg-surface-subtle text-ink-muted [a]:hover:bg-line",
        brand: "bg-brand-100 text-brand-700 [a]:hover:bg-brand-100/70",
        outline: "border border-border bg-surface text-ink-muted",
        green: "bg-green-bg text-green-fg",
        orange: "bg-orange-bg text-orange-fg",
        red: "bg-red-bg text-red-fg",
        expired: "bg-expired-bg text-expired-fg",
        cancelled: "bg-cancelled-bg text-cancelled-fg",
      },
      size: {
        default: "",
        sm: "h-5 px-1.5",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
