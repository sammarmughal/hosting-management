"use client"

import * as React from "react"
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// docs/12 §5: bottom-right on desktop, top on mobile.
const MOBILE_QUERY = "(max-width: 639px)"

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  )
}

const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = useIsMobile()

  return (
    <Sonner
      theme="light"
      position={isMobile ? "top-center" : "bottom-right"}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-green-fg" />,
        info: <InfoIcon className="size-4 text-brand-700" />,
        warning: <TriangleAlertIcon className="size-4 text-orange-fg" />,
        error: <OctagonXIcon className="size-4 text-red-fg" />,
        loading: <Loader2Icon className="size-4 animate-spin text-ink-muted" />,
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--line)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "font-sans! text-base! shadow-lg! gap-3!",
          title: "font-medium!",
          description: "text-sm! text-ink-muted!",
          actionButton: "bg-primary! text-primary-foreground! rounded-md! font-medium!",
          cancelButton: "bg-surface-subtle! text-ink! rounded-md!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
