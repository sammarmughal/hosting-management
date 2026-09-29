import {
  CalendarClockIcon,
  FileUpIcon,
  LayoutDashboardIcon,
  ReceiptIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/clients", label: "Clients", icon: UsersIcon },
  { href: "/reminders", label: "Reminders", icon: CalendarClockIcon },
  { href: "/payments", label: "Payments", icon: ReceiptIcon },
  { href: "/import", label: "Import", icon: FileUpIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
]

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Page titles shown in the topbar. Pages set the same text in their
// metadata for the browser tab ("Clients · Renewals").
const TITLES: [RegExp, string][] = [
  [/^\/dashboard$/, "Dashboard"],
  [/^\/clients$/, "Clients"],
  [/^\/clients\/new$/, "Add client"],
  [/^\/clients\/[^/]+\/edit$/, "Edit client"],
  [/^\/clients\/[^/]+\/services\/new$/, "Add service"],
  [/^\/clients\/[^/]+$/, "Client"],
  [/^\/services\/[^/]+\/edit$/, "Edit service"],
  [/^\/reminders$/, "Reminders"],
  [/^\/payments$/, "Payments"],
  [/^\/notifications$/, "Notifications"],
  [/^\/import$/, "Import"],
  [/^\/settings$/, "Settings"],
]

export function titleFor(pathname: string): string {
  return TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Renewals"
}
