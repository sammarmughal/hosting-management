"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { GLOBAL_SEARCH_ID } from "@/components/layout/global-search"

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    target.getAttribute("role") === "combobox"
  )
}

/** An overlay (dialog, sheet, menu) is open: leave its keys alone. */
function overlayOpen() {
  return !!document.querySelector(
    '[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"]'
  )
}

/**
 * "/" focuses the global search; "N" opens Add client (docs/12 §8).
 * Ignored while typing, with modifier keys, or when an overlay is open.
 */
export function KeyboardShortcuts() {
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      if (isTyping(e.target) || overlayOpen()) return

      if (e.key === "/") {
        // The page's own search (e.g. Clients) wins over the topbar one.
        // Hidden inputs (display: none) have no offsetParent.
        const search = [
          ...document.querySelectorAll<HTMLInputElement>(
            `[data-search-shortcut], #${GLOBAL_SEARCH_ID}`
          ),
        ].find((el) => el.offsetParent !== null)
        if (search) {
          e.preventDefault()
          search.focus()
        }
      } else if ((e.key === "n" || e.key === "N") && pathname !== "/clients/new") {
        e.preventDefault()
        router.push("/clients/new")
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router, pathname])

  return null
}
