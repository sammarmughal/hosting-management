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
  if (href === "/clients" && pathname.startsWith("/services/")) return true
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Plain topbar titles for top-level pages. Detail and edit pages show a
// breadcrumb from the @crumbs slot instead, and their own <PageHeader> H1.
// Pages set the same text in their metadata ("Clients · Renewals").
const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clients": "Clients",
  "/reminders": "Reminders",
  "/payments": "Payments",
  "/notifications": "Notifications",
  "/import": "Import",
  "/settings": "Settings",
}

export function titleFor(pathname: string): string {
  return TITLES[pathname] ?? "Renewals"
}
