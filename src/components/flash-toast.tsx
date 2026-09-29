"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"

/**
 * Shows the toast for a redirect like ?saved=client (docs/06 §3.10), then
 * removes the param so a refresh doesn't show it again.
 */
export function FlashToast({
  message,
  param,
}: {
  message: string | null
  param: string
}) {
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    if (!message) return
    toast.success(message, { id: `flash-${param}` })
    const url = new URL(window.location.href)
    url.searchParams.delete(param)
    router.replace(`${pathname}${url.search}`, { scroll: false })
  }, [message, param, pathname, router])

  return null
}
