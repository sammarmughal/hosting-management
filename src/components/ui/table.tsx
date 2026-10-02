import * as React from "react"

import { cn } from "@/lib/utils"

// docs/12 §5: 36px header (12px muted), 48px rows, horizontal hairlines
// only, subtle hover. First and last cells line up with card padding.
// Right-align numbers and money with className="text-right".

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative max-h-[640px] w-full overflow-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-base", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("sticky top-0 z-10 bg-surface [&_tr]:border-b [&_tr]:hover:bg-transparent", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-surface-hover font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors duration-150 hover:bg-surface-hover has-aria-expanded:bg-surface-hover data-[state=selected]:bg-brand-50",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-ink-muted first:pl-4 last:pr-4 has-[[role=checkbox]]:pr-0 sm:first:pl-5 sm:last:pr-5",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-12 px-3 align-middle whitespace-nowrap first:pl-4 last:pr-4 has-[[role=checkbox]]:pr-0 sm:first:pl-5 sm:last:pr-5",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-ink-muted", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
