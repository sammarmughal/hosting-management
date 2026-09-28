import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-base font-medium whitespace-nowrap transition-colors duration-150 ease-out outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-brand-800 aria-expanded:bg-brand-800",
        outline:
          "border-line-strong bg-surface text-ink hover:bg-surface-hover aria-expanded:bg-surface-subtle",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-line aria-expanded:bg-line",
        ghost: "text-ink hover:bg-surface-subtle aria-expanded:bg-surface-subtle",
        success: "bg-success text-white hover:bg-success-hover",
        whatsapp:
          "border-line-strong bg-surface text-ink hover:bg-surface-hover [&_svg]:text-whatsapp",
        destructive:
          "bg-danger text-white hover:bg-danger-hover focus-visible:ring-destructive/30",
        link: "h-auto! border-0 px-0! text-brand-700 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 gap-1.5 px-3.5",
        sm: "h-8 gap-1.5 px-3 text-sm",
        lg: "h-10 gap-2 px-4",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Shows a spinner, disables the button and keeps its width. */
    loading?: boolean
  }

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && !asChild ? (
        <>
          <span className="invisible inline-flex items-center gap-[inherit]">
            {children}
          </span>
          <Loader2Icon aria-hidden className="absolute animate-spin" />
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Button, buttonVariants, type ButtonProps }
