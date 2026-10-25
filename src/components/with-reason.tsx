import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Wraps a disabled control so its tooltip still explains why (docs/12 §8). */
export function WithReason({
  reason,
  children,
}: {
  reason: string | null
  children: React.ReactNode
}) {
  if (!reason) return <>{children}</>
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-md">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{reason}</TooltipContent>
    </Tooltip>
  )
}
