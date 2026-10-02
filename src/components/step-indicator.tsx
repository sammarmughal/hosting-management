import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol aria-label="Progress" className="mb-6 flex items-center gap-3">
      {steps.map((step, i) => (
        <li
          key={step}
          aria-current={i === current ? "step" : undefined}
          className={cn(
            "flex min-w-0 items-center gap-2 text-xs",
            i === current ? "font-medium text-ink" : "text-ink-muted"
          )}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full border",
              i <= current
                ? "border-brand-700 bg-brand-50 text-brand-700"
                : "border-border"
            )}
          >
            {i < current ? <CheckIcon className="size-3" aria-hidden /> : i + 1}
          </span>
          {step}
          {i < steps.length - 1 && (
            <span aria-hidden className="ml-1 h-px w-3 bg-border sm:w-6" />
          )}
        </li>
      ))}
    </ol>
  )
}
