"use client"

import { useRef, useState, useTransition } from "react"
import Papa from "papaparse"
import Link from "next/link"
import { CircleCheckIcon, UploadIcon, FileSpreadsheetIcon } from "lucide-react"
import { StepIndicator } from "@/components/step-indicator"
import { InlineAlert } from "@/components/inline-alert"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDatePK, isISODate } from "@/lib/domain/dates"
import { downloadText } from "@/lib/download"
import {
  IMPORT_HEADERS,
  previewImport,
  type ImportRow,
  type PreviewRow,
} from "@/lib/domain/import"
import { commitImportAction } from "@/lib/mock/import-actions"
import { cn } from "@/lib/utils"

export function ImportFlow({ domains }: { domains: string[] }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(0)
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<ImportRow[]>([])
  const [error, setError] = useState("")
  const [drag, setDrag] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [update, setUpdate] = useState(false)
  const [page, setPage] = useState(0)
  const [pending, start] = useTransition()
  const [done, setDone] = useState({ created: 0, updated: 0, skipped: 0 })
  const preview = previewImport(rows, domains)
  const counts = {
    valid: preview.filter((r) => r.status === "valid").length,
    warning: preview.filter((r) => r.status === "warning").length,
    error: preview.filter((r) => r.status === "error").length,
  }
  const eligible = preview.filter((r) => r.status !== "error" && (!r.existing || update))
  async function read(file?: File) {
    setError("")
    if (!file) return
    if (!/\.csv$/i.test(file.name)) {
      setError("Choose a .csv file.")
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("The CSV must be 2 MB or smaller.")
      return
    }
    setParsing(true)
    try {
      const text = await file.text()
      const result = Papa.parse<ImportRow>(text, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) =>
          h
            .replace(/^\uFEFF/, "")
            .trim()
            .toLowerCase(),
      })
      if (result.errors.length)
        throw new Error(`Couldn’t read the CSV: ${result.errors[0]?.message}`)
      const missing = ["client_name", "domain", "start_date", "charge_amount"].filter(
        (h) => !result.meta.fields?.includes(h)
      )
      if (missing.length)
        throw new Error(
          `Missing columns: ${missing.join(", ")}. Download the template for the expected format.`
        )
      if (result.data.length > 2000)
        throw new Error("Choose a CSV with no more than 2,000 rows.")
      setRows(result.data)
      setFileName(file.name)
      setPage(0)
      setStep(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t read that file.")
    } finally {
      setParsing(false)
      if (fileInput.current) fileInput.current.value = ""
    }
  }
  return (
    <div className="space-y-6">
      <StepIndicator steps={["Upload", "Preview", "Done"]} current={step} />
      {error && <InlineAlert>{error}</InlineAlert>}
      {step === 0 ? (
        <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <h2 className="text-base font-semibold">Import clients</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Add clients and their hosting services from a CSV file.
          </p>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              void read(e.dataTransfer.files[0])
            }}
            className={cn(
              "mt-5 flex flex-col items-center rounded-lg border border-dashed px-4 py-12 text-center",
              drag ? "border-brand-700 bg-brand-50" : "border-line-strong"
            )}
          >
            <UploadIcon className="mb-3 size-6 text-ink-muted" />
            <p className="text-base font-medium">Drop your CSV here</p>
            <p className="mt-1 text-sm text-ink-muted">.csv only · 2 MB maximum</p>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-label="CSV file"
              onChange={(e) => void read(e.target.files?.[0])}
            />
            <Button
              className="mt-5"
              variant="outline"
              loading={parsing}
              onClick={() => fileInput.current?.click()}
            >
              Choose CSV file
            </Button>
          </div>
          <button
            type="button"
            className="mt-3 inline-flex min-h-11 items-center text-sm text-brand-700 hover:underline"
            onClick={() =>
              downloadText(
                IMPORT_HEADERS.join(",") + "\r\n",
                "renewals-import-template.csv",
                "text/csv"
              )
            }
          >
            Download CSV template
          </button>
        </section>
      ) : step === 1 ? (
        <>
          <div className="form-action-bar justify-between">
            <div>
              <h2 className="max-w-72 truncate text-base font-semibold" title={fileName}>
                {fileName}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Review each row before importing.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setStep(0)
                setError("")
              }}
            >
              Choose another file
            </Button>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Import summary">
            {Object.entries(counts).map(([status, count]) => (
              <span
                key={status}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm",
                  status === "error"
                    ? "bg-red-bg text-red-fg"
                    : status === "warning"
                      ? "bg-orange-bg text-orange-fg"
                      : "bg-green-bg text-green-fg"
                )}
              >
                <span className="status-dot bg-current" />
                {count}{" "}
                {status === "error" && count !== 1
                  ? "errors"
                  : status === "warning" && count !== 1
                    ? "warnings"
                    : status}
              </span>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {preview.length === 0 ? (
              <EmptyState
                icon={FileSpreadsheetIcon}
                message="This file has headers but no rows. Choose a file with client records."
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">Row</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Renewal</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.slice(page * 25, (page + 1) * 25).map((r) => (
                        <TableRow key={r.row}>
                          <TableCell className="text-right text-ink-muted">
                            {r.row}
                          </TableCell>
                          <TableCell>
                            <span
                              className="block max-w-44 truncate"
                              title={r.input.client.name}
                            >
                              {r.input.client.name || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className="block max-w-44 truncate"
                              title={r.input.service.domain}
                            >
                              {r.input.service.domain || "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            {isISODate(r.input.service.renewalDate)
                              ? formatDatePK(r.input.service.renewalDate)
                              : "—"}
                          </TableCell>
                          <TableCell className="py-2">
                            <ImportStatus row={r} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="divide-y divide-border md:hidden">
                  {preview.slice(page * 25, (page + 1) * 25).map((r) => (
                    <li key={r.row} className="space-y-2 p-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="truncate font-medium"
                          title={r.input.client.name}
                        >
                          {r.input.client.name || "Unnamed client"}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">
                          Row {r.row}
                        </span>
                      </div>
                      <p
                        className="truncate text-sm text-ink-muted"
                        title={r.input.service.domain}
                      >
                        {r.input.service.domain || "No domain"}
                      </p>
                      <p className="text-xs text-ink-muted">
                        Renews{" "}
                        {isISODate(r.input.service.renewalDate)
                          ? formatDatePK(r.input.service.renewalDate)
                          : "—"}
                      </p>
                      <ImportStatus row={r} />
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-end gap-2 border-t border-border p-3 text-sm text-ink-muted">
                  <span>
                    {page * 25 + 1}–{Math.min((page + 1) * 25, preview.length)} of{" "}
                    {preview.length}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * 25 >= preview.length}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </div>
              </>
            )}
          </div>
          <div className="form-action-bar justify-between">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Checkbox
                checked={update}
                onCheckedChange={(v) => setUpdate(v === true)}
                disabled={pending}
              />
              Update existing domains
            </label>
            <Button
              disabled={!eligible.length}
              loading={pending}
              onClick={() =>
                start(async () => {
                  setError("")
                  try {
                    const res = await commitImportAction(
                      eligible.map((r) => r.input),
                      update
                    )
                    if (!res.ok) setError(res.error)
                    else {
                      setDone({
                        ...res.data!,
                        skipped:
                          (res.data?.skipped ?? 0) + preview.length - eligible.length,
                      })
                      setStep(2)
                    }
                  } catch {
                    setError("Couldn’t import the file. Try again.")
                  }
                })
              }
            >
              Import {eligible.length} {eligible.length === 1 ? "row" : "rows"}
            </Button>
          </div>
        </>
      ) : (
        <section className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <CircleCheckIcon className="mb-3 size-6 text-ink-muted" />
          <h2 className="text-base font-semibold">Import complete</h2>
          <p className="mt-2 text-sm text-ink-muted">
            {done.created} created · {done.updated} updated · {done.skipped} skipped
          </p>
          <Button asChild className="mt-5">
            <Link href="/clients">Go to clients</Link>
          </Button>
        </section>
      )}
    </div>
  )
}

function ImportStatus({ row }: { row: PreviewRow }) {
  return (
    <div>
      <span
        className={cn(
          "text-sm font-medium",
          row.status === "error"
            ? "text-red-fg"
            : row.status === "warning"
              ? "text-orange-fg"
              : "text-green-fg"
        )}
      >
        {row.status === "valid"
          ? "Valid"
          : row.status === "warning"
            ? "Warning"
            : "Error"}
      </span>
      <p className="max-w-80 text-xs whitespace-normal text-ink-muted">{row.message}</p>
    </div>
  )
}
