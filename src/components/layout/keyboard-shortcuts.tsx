"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"

import { GLOBAL_SEARCH_ID } from "@/components/layout/global-search"
import { fabFor } from "@/components/layout/nav"

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
 * "/" focuses the global search; "N" opens the page's "Add …" form, else
 * Add subscription (docs/12 §8, docs/14 §7).
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
        // The page's own search (e.g. Subscriptions) wins over the topbar one.
        // Hidden inputs (display: none) have no offsetParent.
        const search =
          [
            ...document.querySelectorAll<HTMLInputElement>("main [data-search-shortcut]"),
          ].find((el) => el.offsetParent !== null) ??
          document.getElementById(GLOBAL_SEARCH_ID)
        if (search && search.offsetParent !== null) {
          e.preventDefault()
          search.focus()
        } else {
          e.preventDefault()
          router.push("/subscriptions?focus=search")
        }
      } else if (e.key === "n" || e.key === "N") {
        const href = fabFor(pathname)?.href ?? "/subscriptions/new"
        if (pathname === href) return
        e.preventDefault()
        router.push(href)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [router, pathname])

  return null
}
