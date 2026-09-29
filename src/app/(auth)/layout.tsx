import { LogoMark } from "@/components/layout/logo"

// Centred 400px card on the page background, no sidebar (docs/06 §4.1).
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pt-[max(3rem,12dvh)] pb-12">
      <div className="w-full max-w-100">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <LogoMark className="size-7" />
          <span className="text-md font-semibold text-ink">Renewals</span>
        </div>
        <div className="rounded-lg border border-border bg-surface p-6 shadow-xs sm:p-8">
          {children}
        </div>
      </div>
    </main>
  )
}
