"use client"

import { CopyIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { downloadText } from "@/lib/download"

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard")
  } catch {
    toast.error("Couldn’t copy. Select the text and copy it manually.")
  }
}

export function RecoveryCodes({ codes }: { codes: string[] }) {
  return (
    <div className="space-y-4">
      <div
        className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-subtle p-3"
        aria-label="Recovery codes"
      >
        {codes.map((code) => (
          <code key={code} className="py-1 text-center text-sm">
            {code}
          </code>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void copyText(codes.join("\n"))}
        >
          <CopyIcon />
          Copy all
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            downloadText(codes.join("\n") + "\n", "renewals-recovery-codes.txt")
          }
        >
          <DownloadIcon />
          Download .txt
        </Button>
      </div>
    </div>
  )
}
