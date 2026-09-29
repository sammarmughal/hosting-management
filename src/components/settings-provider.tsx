"use client"

import * as React from "react"

import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/domain/status"

// The server reads the thresholds from settings and passes them down, so
// <TimerPill> colours match the server exactly (docs/04 §2).
const ThresholdsContext = React.createContext<Thresholds>(DEFAULT_THRESHOLDS)

export function SettingsProvider({
  thresholds,
  children,
}: {
  thresholds: Thresholds
  children: React.ReactNode
}) {
  return (
    <ThresholdsContext.Provider value={thresholds}>{children}</ThresholdsContext.Provider>
  )
}

export function useThresholds(): Thresholds {
  return React.useContext(ThresholdsContext)
}
