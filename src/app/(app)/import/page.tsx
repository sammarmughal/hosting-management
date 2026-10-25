import type { Metadata } from "next"

import { ImportFlow } from "@/components/import/import-flow"
import { LinkTabs } from "@/components/link-tabs"
import { IMPORT_LABEL, type ImportKind } from "@/lib/domain/import"
import { getImportContext } from "@/lib/data"

export const metadata: Metadata = { title: "Import" }

const KINDS: ImportKind[] = ["clients", "companies", "subscriptions"]

// docs/14 §9: one CSV per kind, imported in this order.
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const kind = KINDS.find((k) => k === sp.kind) ?? "clients"
  const ctx = await getImportContext()
  return (
    <div className="flex flex-col gap-6">
      <LinkTabs
        label="What to import"
        tabs={KINDS.map((k, i) => ({
          href: `/import?kind=${k}`,
          label: `${i + 1}. ${IMPORT_LABEL[k]}`,
          active: k === kind,
        }))}
      />
      <ImportFlow key={kind} kind={kind} context={ctx} />
    </div>
  )
}
