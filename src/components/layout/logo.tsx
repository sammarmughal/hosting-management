import { cn } from "@/lib/utils"

/** The logo mark: a brand square with a renew arrow (same as the favicon). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-6 shrink-0 text-brand-700", className)}
    >
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path
        d="M22.4 11.2A7.5 7.5 0 1 0 23.5 17.5"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M23 7.2v4.6h-4.6"
        fill="none"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
