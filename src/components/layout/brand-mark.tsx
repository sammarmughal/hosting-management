import { LogoMark } from "@/components/layout/logo"
import { cn } from "@/lib/utils"
import type { ShellBrand } from "@/types/view"

/**
 * The business's mark in the sidebar and drawer: the uploaded logo, else the
 * initials of the business name in a small brand square ("AR"), else the app mark.
 */
export function BrandMark({
  brand,
  className,
}: {
  brand: ShellBrand
  className?: string
}) {
  if (brand.logoVersion) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- small, private, already sized
      <img
        src={`/api/brand/logo?v=${brand.logoVersion}`}
        alt=""
        className={cn("size-6 shrink-0 rounded-[5px] object-contain", className)}
      />
    )
  }
  if (!brand.initials) return <LogoMark className={className} />
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-[5px] bg-brand-700 text-[10px] leading-none font-semibold tracking-[0.02em] text-white",
        className
      )}
    >
      {brand.initials}
    </span>
  )
}
