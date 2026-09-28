import type { Metadata } from "next"
import { notFound } from "next/navigation"
import {
  CheckIcon,
  InboxIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SendIcon,
  UsersIcon,
} from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { MoneyValue, StatCard } from "@/components/stat-card"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Colour } from "@/types/view"

import {
  DisabledWithReason,
  LoadingButtonDemo,
  RenewDialogDemo,
  ToastDemo,
} from "./_components/demos"

export const metadata: Metadata = { title: "Styleguide" }

// Development-only reference for every token and component (docs/12).
export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound()

  return (
    <main className="max-w-300 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-[-0.01em]">Styleguide</h1>
        <p className="text-sm text-ink-muted">
          Tokens and components for Renewals. Every screen is built from these.
        </p>
        <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-sm text-ink-muted transition-colors hover:text-ink"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <div className="mt-8">
        <ColoursSection />
        <TypographySection />
        <ButtonsSection />
        <FormsSection />
        <BadgesSection />
        <TimerPillsSection />
        <StatCardsSection />
        <TableSection />
        <OverlaysSection />
        <StatesSection />
      </div>
    </main>
  )
}

const SECTIONS = [
  ["colours", "Colours"],
  ["type", "Typography"],
  ["buttons", "Buttons"],
  ["forms", "Forms"],
  ["badges", "Badges"],
  ["timers", "Timer pills"],
  ["stats", "Stat cards"],
  ["table", "Table"],
  ["overlays", "Overlays"],
  ["states", "Empty and loading"],
] as const

/* ------------------------------------------------------------------ */

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-6 border-t border-border py-8 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8"
    >
      <div className="mb-5 lg:mb-0">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-6">{children}</div>
    </section>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-medium text-ink-muted">{label}</h3>
      {children}
    </div>
  )
}

/* Colours ----------------------------------------------------------- */

type SwatchDef = { name: string; hex: string; className: string }

const BRAND: SwatchDef[] = [
  { name: "brand-900", hex: "#0F2A44", className: "bg-brand-900" },
  { name: "brand-800", hex: "#173D5F", className: "bg-brand-800" },
  { name: "brand-700", hex: "#1F4E79", className: "bg-brand-700" },
  { name: "brand-500", hex: "#2E75B6", className: "bg-brand-500" },
  { name: "brand-100", hex: "#E6EFF8", className: "bg-brand-100" },
  { name: "brand-50", hex: "#F3F7FC", className: "bg-brand-50" },
]

const NEUTRALS: SwatchDef[] = [
  { name: "ink", hex: "#111827", className: "bg-ink" },
  { name: "ink-muted", hex: "#6B7280", className: "bg-ink-muted" },
  { name: "ink-subtle", hex: "#9CA3AF", className: "bg-ink-subtle" },
  { name: "line-strong", hex: "#D5D9E0", className: "bg-line-strong" },
  { name: "line", hex: "#E6E8EC", className: "bg-line" },
  { name: "surface-subtle", hex: "#F3F4F6", className: "bg-surface-subtle" },
  { name: "surface-hover", hex: "#F9FAFB", className: "bg-surface-hover" },
  { name: "page", hex: "#F7F8FA", className: "bg-page" },
  { name: "surface", hex: "#FFFFFF", className: "bg-surface" },
]

const STATUS: { key: Colour; label: string; dot: string; fg: string; bg: string }[] = [
  {
    key: "green",
    label: "Green",
    dot: "bg-green",
    fg: "text-green-fg",
    bg: "bg-green-bg",
  },
  {
    key: "orange",
    label: "Orange",
    dot: "bg-orange",
    fg: "text-orange-fg",
    bg: "bg-orange-bg",
  },
  { key: "red", label: "Red", dot: "bg-red", fg: "text-red-fg", bg: "bg-red-bg" },
  {
    key: "expired",
    label: "Expired",
    dot: "bg-expired",
    fg: "text-expired-fg",
    bg: "bg-expired-bg",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    dot: "bg-cancelled",
    fg: "text-cancelled-fg",
    bg: "bg-cancelled-bg",
  },
]

function Swatch({ name, hex, className }: SwatchDef) {
  return (
    <div className="min-w-0">
      <div className={cn("h-10 rounded-md border border-black/5", className)} />
      <div className="mt-2 truncate text-sm font-medium">{name}</div>
      <div className="font-mono text-xs text-ink-muted">{hex}</div>
    </div>
  )
}

function ColoursSection() {
  return (
    <Section
      id="colours"
      title="Colours"
      description="About 90% neutral. Brand for the primary action, links and focus. Status colours only where they carry meaning."
    >
      <Group label="Brand">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {BRAND.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </Group>
      <Group label="Neutrals">
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5 xl:grid-cols-9">
          {NEUTRALS.map((s) => (
            <Swatch key={s.name} {...s} />
          ))}
        </div>
      </Group>
      <Group label="Status: dot, text on tint, tint">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {STATUS.map((s) => (
            <div key={s.key} className={cn("rounded-md px-3 py-2.5", s.bg)}>
              <div className={cn("flex items-center gap-2 text-sm font-medium", s.fg)}>
                <span aria-hidden className={cn("status-dot", s.dot)} />
                {s.label}
              </div>
              <div className={cn("mt-0.5 font-mono text-xs opacity-80", s.fg)}>
                {s.key}-fg on {s.key}-bg
              </div>
            </div>
          ))}
        </div>
      </Group>
    </Section>
  )
}

/* Typography -------------------------------------------------------- */

const TYPE_SCALE = [
  {
    cls: "text-2xl font-semibold tracking-tight",
    spec: "28 / 600",
    use: "Stat values",
    sample: "124",
  },
  {
    cls: "text-xl font-semibold tracking-[-0.01em]",
    spec: "22 / 600",
    use: "Page title",
    sample: "Dashboard",
  },
  {
    cls: "text-lg font-semibold",
    spec: "18 / 600",
    use: "Rare: large headings",
    sample: "Client details",
  },
  {
    cls: "text-md font-semibold",
    spec: "16 / 600",
    use: "Dialog title",
    sample: "Renew noordental.pk",
  },
  {
    cls: "text-base font-semibold",
    spec: "14 / 600",
    use: "Card title",
    sample: "Reminders due",
  },
  {
    cls: "text-base",
    spec: "14 / 400",
    use: "Body, table cells",
    sample: "3 renewals need attention this week",
  },
  {
    cls: "text-sm text-ink-muted",
    spec: "13 / 400",
    use: "Labels, meta",
    sample: "Last checked 10 minutes ago",
  },
  {
    cls: "text-xs font-medium text-ink-muted",
    spec: "12 / 500",
    use: "Table headers, captions",
    sample: "Renewal date",
  },
  {
    cls: "font-mono text-xs",
    spec: "Mono 12",
    use: "Timers, codes",
    sample: "02d 08h 14m 31s",
  },
]

function TypographySection() {
  return (
    <Section
      id="type"
      title="Typography"
      description="Geist Sans for UI, Geist Mono for timers and codes. Base 14px. All numbers are tabular."
    >
      <Card className="gap-0 py-0">
        {TYPE_SCALE.map((t) => (
          <div
            key={t.spec + t.use}
            className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-0 sm:flex-row sm:items-baseline sm:gap-6 sm:px-5"
          >
            <div className="w-40 shrink-0 text-xs text-ink-muted">
              <span className="font-mono">{t.spec}</span> · {t.use}
            </div>
            <div className={cn("min-w-0 truncate", t.cls)}>{t.sample}</div>
          </div>
        ))}
      </Card>
      <Group label="Tabular numbers">
        <div className="inline-grid rounded-lg border border-border bg-surface px-5 py-3 text-right text-base">
          <span>PKR 6,500</span>
          <span>PKR 24,750</span>
          <span>PKR 111,111</span>
        </div>
      </Group>
    </Section>
  )
}

/* Buttons ----------------------------------------------------------- */

function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      description="One primary per area. Verb labels. Icons only where they add meaning. 36px default, 32px small."
    >
      <Group label="Variants">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Save client</Button>
          <Button variant="outline">Cancel</Button>
          <Button variant="secondary">Export CSV</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="success">
            <CheckIcon />
            Mark paid
          </Button>
          <Button variant="whatsapp">
            <MessageCircleIcon />
            Open WhatsApp
          </Button>
          <Button variant="destructive">Delete client</Button>
          <Button variant="link">View all</Button>
        </div>
      </Group>
      <Group label="Sizes">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">
            <PlusIcon />
            Add client
          </Button>
          <Button>
            <PlusIcon />
            Add client
          </Button>
          <Button size="lg">
            <PlusIcon />
            Add client
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" aria-label="Check now">
                <RefreshCwIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Check now</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Check now">
                <RefreshCwIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Check now</TooltipContent>
          </Tooltip>
        </div>
      </Group>
      <Group label="Loading and disabled">
        <div className="flex flex-wrap items-center gap-2">
          <LoadingButtonDemo />
          <Button variant="outline" loading>
            Retry failed
          </Button>
          <Button disabled>Save client</Button>
          <DisabledWithReason />
        </div>
      </Group>
    </Section>
  )
}

/* Forms ------------------------------------------------------------- */

function Field({
  id,
  label,
  required,
  help,
  error,
  children,
  className,
}: {
  id: string
  label: string
  required?: boolean
  help?: React.ReactNode
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span aria-hidden className="-ml-1 text-red-fg">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-fg">
          {error}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-xs text-ink-muted">
          {help}
        </p>
      ) : null}
    </div>
  )
}

function FormsSection() {
  return (
    <Section
      id="forms"
      title="Forms"
      description="Labels above fields. Brand border and a soft ring on focus. Errors in 12px red below the field."
    >
      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field
            id="sg-name"
            label="Client name"
            required
            help="As it should appear in reminders."
          >
            <Input
              id="sg-name"
              defaultValue="Ayesha Siddiqui"
              aria-describedby="sg-name-help"
            />
          </Field>
          <Field id="sg-email" label="Email" error="Enter a valid email address.">
            <Input
              id="sg-email"
              type="email"
              defaultValue="ayesha.siddiqui@gmail"
              aria-invalid
              aria-describedby="sg-email-error"
            />
          </Field>
          <Field
            id="sg-phone"
            label="WhatsApp phone"
            help={
              <span className="inline-flex items-center gap-1">
                WhatsApp: +92 300 1234567
                <CheckIcon aria-label="valid" className="size-3.5 text-green-fg" />
              </span>
            }
          >
            <Input
              id="sg-phone"
              inputMode="tel"
              placeholder="03001234567 or +923001234567"
              defaultValue="0300 1234567"
              aria-describedby="sg-phone-help"
            />
          </Field>
          <Field id="sg-charge" label="Charge" required>
            <div className="flex gap-2">
              <Input
                id="sg-charge"
                inputMode="decimal"
                defaultValue="6,500.00"
                className="min-w-0 flex-1 text-right"
              />
              <Select defaultValue="PKR">
                <SelectTrigger aria-label="Currency" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["PKR", "USD", "AED", "GBP", "EUR"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Field id="sg-plan" label="Plan">
            <Select>
              <SelectTrigger id="sg-plan" className="w-full">
                <SelectValue placeholder="Choose a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shared-10">Shared 10 GB</SelectItem>
                <SelectItem value="shared-50">Shared 50 GB</SelectItem>
                <SelectItem value="business">Business</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            id="sg-start"
            label="Start date"
            help="Renewal date: auto, start + 1 year."
          >
            <Input id="sg-start" type="date" defaultValue="2025-09-30" />
          </Field>
          <Field
            id="sg-domain"
            label="Domain"
            help="Domain can't be changed after the first payment."
          >
            <Input id="sg-domain" defaultValue="noordental.pk" disabled />
          </Field>
          <Field id="sg-notes" label="Notes" className="sm:col-span-2">
            <Textarea
              id="sg-notes"
              placeholder="Anything worth remembering about this client"
            />
          </Field>
        </CardContent>
      </Card>

      <Group label="Choices">
        <Card>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-0.5">
                <Label htmlFor="sg-reminders">Send reminders</Label>
                <p className="text-xs text-ink-muted">
                  Queue email and WhatsApp reminders for this service.
                </p>
              </div>
              <Switch id="sg-reminders" defaultChecked />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-0.5">
                <Label htmlFor="sg-autosend">Auto-send emails</Label>
                <p className="text-xs text-ink-muted">
                  Send pending emails when the dashboard checks.
                </p>
              </div>
              <Switch id="sg-autosend" />
            </div>
            <Label className="font-normal">
              <Checkbox defaultChecked />
              Also email me the summary
            </Label>
            <Label className="font-normal">
              <Checkbox />
              Update existing domains
            </Label>
          </CardContent>
        </Card>
      </Group>
    </Section>
  )
}

/* Badges ------------------------------------------------------------ */

function BadgesSection() {
  return (
    <Section
      id="badges"
      title="Badges"
      description="Dot and text in the same family as the timer pill. Never colour alone."
    >
      <Group label="Status">
        <div className="flex flex-wrap gap-2">
          {(["green", "orange", "red", "expired", "cancelled"] as const).map((c) => (
            <StatusBadge key={c} colour={c} />
          ))}
        </div>
      </Group>
      <Group label="Other">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>12</Badge>
          <Badge variant="brand">Auto-send on</Badge>
          <Badge variant="outline">Shared 10 GB</Badge>
          <Badge variant="neutral" size="sm">
            3
          </Badge>
        </div>
      </Group>
    </Section>
  )
}

/* Timer pills ------------------------------------------------------- */

const PILLS: { cls: Colour; md: string; sm: string; label: string }[] = [
  { cls: "green", md: "112d 06h 09m 50s", sm: "112d 06h", label: "112 days left" },
  { cls: "orange", md: "17d 11h 42m 05s", sm: "17d 11h", label: "17 days left" },
  { cls: "red", md: "02d 08h 14m 31s", sm: "02d 08h", label: "2 days left" },
  {
    cls: "expired",
    md: "Expired 4 days ago",
    sm: "Expired 4 days ago",
    label: "expired 4 days ago",
  },
  { cls: "cancelled", md: "Cancelled", sm: "Cancelled", label: "cancelled" },
]

function Pill({
  colour,
  size,
  text,
  label,
}: {
  colour: Colour
  size: "sm" | "md" | "lg"
  text: string
  label: string
}) {
  return (
    <span
      className={cn("timer-pill", `is-${colour}`, `timer-pill--${size}`)}
      title={label}
    >
      <span className="timer-dot" />
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  )
}

function TimerPillsSection() {
  return (
    <Section
      id="timers"
      title="Timer pills"
      description="Fixed min-width and mono digits so columns never jitter. Only the red dot pulses; reduced motion turns it off."
    >
      <Card className="gap-0 py-0">
        <div className="hidden grid-cols-[120px_200px_200px_1fr] gap-x-6 border-b border-border px-5 py-2 text-xs font-medium text-ink-muted sm:grid">
          <span>State</span>
          <span>sm</span>
          <span>md</span>
          <span>lg</span>
        </div>
        {PILLS.map((p) => (
          <div
            key={p.cls}
            className="grid grid-cols-1 items-center gap-2 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[120px_200px_200px_1fr] sm:justify-start sm:gap-x-6 sm:px-5"
          >
            <span className="text-sm text-ink-muted">{`is-${p.cls}`}</span>
            <span>
              <Pill colour={p.cls} size="sm" text={p.sm} label={p.label} />
            </span>
            <span>
              <Pill colour={p.cls} size="md" text={p.md} label={p.label} />
            </span>
            <span>
              <Pill colour={p.cls} size="lg" text={p.md} label={p.label} />
            </span>
          </div>
        ))}
      </Card>
      <Group label="Before hydration (static label, no mismatch)">
        <div className="flex flex-wrap gap-2">
          <Pill colour="orange" size="md" text="17 days left" label="17 days left" />
          <Pill colour="red" size="md" text="Expires today" label="expires today" />
          <Pill
            colour="expired"
            size="md"
            text="Expired 4 days ago"
            label="expired 4 days ago"
          />
        </div>
      </Group>
    </Section>
  )
}

/* Stat cards -------------------------------------------------------- */

function StatCardsSection() {
  return (
    <Section
      id="stats"
      title="Stat cards"
      description="Label with a status dot, the number in ink. The whole card links to a filtered list."
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 2xl:grid-cols-5">
        <StatCard label="Active services" value="124" href="#stats" />
        <StatCard
          label="Expiring in 30 days"
          value="11"
          sub="PKR 86,500 due"
          dot="orange"
          href="#stats"
        />
        <StatCard label="Urgent, 7 days" value="3" dot="red" href="#stats" />
        <StatCard
          label="Expired"
          value="2"
          sub="Oldest 9 days ago"
          dot="expired"
          href="#stats"
        />
        <StatCard
          label="Expected, 30 days"
          value={<MoneyValue currency="PKR" amount="86,500" />}
          href="#stats"
          className="col-span-2 sm:col-span-1"
        />
      </div>
    </Section>
  )
}

/* Table ------------------------------------------------------------- */

const ROWS: {
  name: string
  sub: string
  domain: string
  renewal: string
  charge: string
  pill: { colour: Colour; text: string; label: string }
}[] = [
  {
    name: "Ayesha Siddiqui",
    sub: "ayesha.siddiqui@gmail.com",
    domain: "ayeshacouture.pk",
    renewal: "30 Sep 2026",
    charge: "PKR 6,500",
    pill: { colour: "red", text: "02d 08h 14m 31s", label: "2 days left" },
  },
  {
    name: "Noor Dental Clinic",
    sub: "Dr. Farah Noor",
    domain: "noordental.pk",
    renewal: "15 Oct 2026",
    charge: "PKR 8,000",
    pill: { colour: "orange", text: "17d 11h 42m 05s", label: "17 days left" },
  },
  {
    name: "Al-Madina Textiles (Pvt) Ltd, Faisalabad Head Office",
    sub: "accounts@almadinatextiles.com.pk",
    domain: "almadinatextiles.com.pk",
    renewal: "18 Jan 2027",
    charge: "PKR 24,750",
    pill: { colour: "green", text: "112d 06h 09m 50s", label: "112 days left" },
  },
  {
    name: "Bilal Traders",
    sub: "0321 4567890",
    domain: "bilaltraders.com",
    renewal: "24 Sep 2026",
    charge: "PKR 4,500",
    pill: { colour: "expired", text: "Expired 4 days ago", label: "expired 4 days ago" },
  },
  {
    name: "Karachi Auto Parts",
    sub: "Imran Qureshi",
    domain: "karachiautoparts.pk",
    renewal: "2 Mar 2027",
    charge: "PKR 12,000",
    pill: { colour: "cancelled", text: "Cancelled", label: "cancelled" },
  },
]

function RowActions({ name }: { name: string }) {
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${name}`}
              className="text-ink-muted opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 pointer-coarse:opacity-100"
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>View client</DropdownMenuItem>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuItem>Renew</DropdownMenuItem>
        <DropdownMenuItem>
          <MessageCircleIcon />
          Open WhatsApp
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TableSection() {
  return (
    <Section
      id="table"
      title="Table"
      description="48px rows, hairlines only, subtle hover. Two-line client cell, money right-aligned, actions in a trailing menu."
    >
      <Card className="gap-0 pb-0">
        <CardHeader className="border-b">
          <CardTitle>Due soon</CardTitle>
          <CardDescription>
            Renewals in the next 30 days and expired services
          </CardDescription>
          <CardAction>
            <Button variant="link" size="sm">
              View all
            </Button>
          </CardAction>
        </CardHeader>
        <Table className="min-w-190 table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[30%]">Client</TableHead>
              <TableHead className="w-[20%]">Domain</TableHead>
              <TableHead className="w-32">Renewal date</TableHead>
              <TableHead className="w-28 text-right">Charge</TableHead>
              <TableHead className="w-48 pl-6">Time left</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROWS.map((r) => (
              <TableRow key={r.domain} className="group/row">
                <TableCell>
                  <div className="truncate font-medium" title={r.name}>
                    {r.name}
                  </div>
                  <div className="truncate text-xs text-ink-muted" title={r.sub}>
                    {r.sub}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="truncate" title={r.domain}>
                    {r.domain}
                  </div>
                </TableCell>
                <TableCell className="text-ink-muted">{r.renewal}</TableCell>
                <TableCell className="text-right">{r.charge}</TableCell>
                <TableCell className="pl-6">
                  <Pill
                    colour={r.pill.colour}
                    size="md"
                    text={r.pill.text}
                    label={r.pill.label}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <RowActions name={r.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </Section>
  )
}

/* Overlays ---------------------------------------------------------- */

function OverlaysSection() {
  return (
    <Section
      id="overlays"
      title="Overlays"
      description="Dialogs are 480px (560 for renew) and a full-screen sheet on mobile. Toasts sit bottom-right, top on mobile."
    >
      <Group label="Dialog">
        <RenewDialogDemo />
      </Group>
      <Group label="Toasts">
        <ToastDemo />
      </Group>
      <Group label="Menu and tabs">
        <div className="flex flex-col gap-6">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-fit">
                Admin summary
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>
                <SendIcon />
                Email me the summary
              </DropdownMenuItem>
              <DropdownMenuItem>
                <MessageCircleIcon />
                WhatsApp me the summary
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tabs defaultValue="payments">
            <TabsList variant="line">
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="log">Reminder log</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
            <TabsContent value="payments" className="pt-3 text-ink-muted">
              2 payments, last on 30 Sep 2025.
            </TabsContent>
            <TabsContent value="log" className="pt-3 text-ink-muted">
              6 reminders sent for this service.
            </TabsContent>
            <TabsContent value="activity" className="pt-3 text-ink-muted">
              Client created on 30 Sep 2025.
            </TabsContent>
          </Tabs>
        </div>
      </Group>
    </Section>
  )
}

/* Empty and loading ------------------------------------------------- */

function StatesSection() {
  return (
    <Section
      id="states"
      title="Empty and loading"
      description="One icon, one sentence, one button. Skeletons match the real layout; never a full-page spinner."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="py-0">
          <EmptyState
            icon={UsersIcon}
            message="No clients yet. Add one to start tracking renewals."
            action={
              <Button size="sm">
                <PlusIcon />
                Add client
              </Button>
            }
          />
        </Card>
        <Card className="py-0">
          <EmptyState icon={InboxIcon} message="All caught up, no reminders due." />
        </Card>
      </div>

      <Group label="Skeletons">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 2xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-lg border border-border bg-surface p-4 sm:p-5",
                  i === 4 && "col-span-2 sm:col-span-1"
                )}
              >
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-3.5 h-7 w-14" />
              </div>
            ))}
          </div>
          <Card className="gap-0 py-0">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="flex h-12 items-center gap-4 border-b border-border px-4 last:border-0 sm:px-5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3 w-36 max-w-full" />
                  <Skeleton className="h-2.5 w-24 max-w-full" />
                </div>
                <Skeleton className="hidden h-3 w-28 sm:block" />
                <Skeleton className="hidden h-3 w-16 md:block" />
                <Skeleton className="h-6 w-32 rounded-full" />
              </div>
            ))}
          </Card>
        </div>
      </Group>
    </Section>
  )
}
