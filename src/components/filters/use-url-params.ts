"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * List filters live in the URL (docs/07 §1), so views are shareable and
 * survive refresh. `update` merges a patch into the current query string
 * (empty values are removed) and resets the page unless the patch sets it.
 */
export function useUrlParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = React.useTransition()

  const update = React.useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      if (!("page" in patch)) next.delete("page")
      const qs = next.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, searchParams]
  )

  return { update, pending }
}
