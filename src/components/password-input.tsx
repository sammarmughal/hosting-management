"use client"

import { useState, type ComponentProps } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function PasswordInput(props: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className="pr-12" />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute inset-y-0 right-0 h-full w-11 text-ink-muted"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </Button>
    </div>
  )
}
