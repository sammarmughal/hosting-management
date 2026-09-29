"use client"

import { LogOutIcon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { logoutAction } from "@/lib/mock/actions"
import { cn } from "@/lib/utils"

function LogoutButton({ side }: { side: "right" | "top" }) {
  const { pending } = useFormStatus()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          loading={pending}
          aria-label="Log out"
          className="text-ink-muted hover:text-ink"
        >
          <LogOutIcon />
        </Button>
      </TooltipTrigger>
      <TooltipContent side={side}>Log out</TooltipContent>
    </Tooltip>
  )
}

/** Admin name + logout at the bottom of the sidebar / drawer. */
export function AccountRow({ name, rail = false }: { name: string; rail?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 border-t border-border p-3",
        rail && "max-lg:flex-col max-lg:gap-2 max-lg:px-0"
      )}
    >
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <div className={cn("min-w-0 flex-1", rail && "max-lg:sr-only")}>
        <div className="truncate text-sm font-medium text-ink">{name}</div>
        <div className="truncate text-xs text-ink-muted">Administrator</div>
      </div>
      <form action={logoutAction}>
        <LogoutButton side={rail ? "right" : "top"} />
      </form>
    </div>
  )
}
