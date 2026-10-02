import Link from "next/link"
import { AlertCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ErrorState({ title, message, href = "/dashboard", label = "Back to dashboard", retry }: { title: string; message: string; href?: string; label?: string; retry?: () => void }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12 in-[main]:min-h-[calc(100dvh-248px)] in-[main]:px-0 md:in-[main]:min-h-[calc(100dvh-152px)]">
      <section className="w-full max-w-100 rounded-lg border border-border bg-surface p-4 sm:p-5 text-center">
        <AlertCircleIcon aria-hidden className="mx-auto mb-4 size-6 text-ink-muted" />
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-ink-muted">{message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="outline"><Link href={href}>{label}</Link></Button>
          {retry && <Button onClick={retry}>Retry loading</Button>}
        </div>
      </section>
    </div>
  )
}
