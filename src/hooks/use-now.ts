"use client"

import { useSyncExternalStore } from "react"

// One shared 1-second ticker drives every timer on the page (docs/06 §5),
// instead of a setInterval per pill.
let now = 0
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function subscribe(cb: () => void) {
  listeners.add(cb)
  if (!timer) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size && timer) {
      clearInterval(timer)
      timer = null
    }
  }
}

/** Current epoch ms on the client (ticking each second); null during SSR/hydration. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => now || null,
    () => null
  )
}
