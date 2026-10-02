"use client"

import { useRef } from "react"
import { Input } from "@/components/ui/input"

export function OtpInput({
  value,
  onChange,
  invalid = false,
}: {
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  function insert(index: number, text: string) {
    const digits = text.replace(/\D/g, "").slice(0, 6)
    if (!digits) return
    const next = value.padEnd(6, " ").split("")
    const start = digits.length === 6 ? 0 : index
    for (let i = 0; i < digits.length && start + i < 6; i++)
      next[start + i] = digits.charAt(i)
    onChange(next.join("").trimEnd())
    refs.current[Math.min(5, start + digits.length)]?.focus()
  }
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">Verification code</legend>
      <div
        className="grid grid-cols-6 gap-1 sm:gap-2"
        onPaste={(e) => {
          e.preventDefault()
          insert(0, e.clipboardData.getData("text"))
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Input
            key={i}
            ref={(el) => {
              refs.current[i] = el
            }}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            value={value[i]?.trim() ?? ""}
            className="h-12 px-0 text-center font-mono text-lg"
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              if (e.target.value) insert(i, e.target.value)
              else {
                const next = value.padEnd(6, " ").split("")
                next[i] = " "
                onChange(next.join("").trimEnd())
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !value[i]?.trim() && i > 0)
                refs.current[i - 1]?.focus()
              if (e.key === "ArrowLeft") {
                e.preventDefault()
                refs.current[Math.max(0, i - 1)]?.focus()
              }
              if (e.key === "ArrowRight") {
                e.preventDefault()
                refs.current[Math.min(5, i + 1)]?.focus()
              }
            }}
          />
        ))}
      </div>
    </fieldset>
  )
}
