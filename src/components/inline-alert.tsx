import { AlertCircleIcon } from "lucide-react"

export function InlineAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-red/20 bg-red-bg p-3 text-sm text-red-fg"
    >
      <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}
