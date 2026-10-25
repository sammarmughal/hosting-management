import {
  Building2Icon,
  CalendarClockIcon,
  FileTextIcon,
  FileUpIcon,
  LayoutDashboardIcon,
  LayoutListIcon,
  ReceiptIcon,
  RefreshCwIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

/** The sidebar, in the client's order (docs/14 §0). */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/clients", label: "Clients", icon: UsersIcon },
  { href: "/companies", label: "Companies", icon: Building2Icon },
  { href: "/service-catalog", label: "Service Catalog", icon: LayoutListIcon },
  { href: "/subscriptions", label: "Subscriptions", icon: RefreshCwIcon },
  { href: "/reminders", label: "Reminders", icon: CalendarClockIcon },
  { href: "/invoices", label: "Invoices", icon: FileTextIcon },
  { href: "/payments", label: "Payments", icon: ReceiptIcon },
  { href: "/import", label: "Import", icon: FileUpIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
]

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

// Plain topbar titles for top-level pages. Detail and edit pages show a
// breadcrumb from the @crumbs slot instead, and their own <PageHeader> H1.
// Pages set the same text in their metadata ("Clients · Renewals").
const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/clients": "Clients",
  "/companies": "Companies",
  "/service-catalog": "Service Catalog",
  "/subscriptions": "Subscriptions",
  "/reminders": "Reminders",
  "/invoices": "Invoices",
  "/payments": "Payments",
  "/notifications": "Notifications",
  "/import": "Import",
  "/settings": "Settings",
}

export function titleFor(pathname: string): string {
  return TITLES[pathname] ?? "Renewals"
}

/**
 * The mobile floating "+" (docs/14 §7): Add subscription on the dashboard
 * and the subscriptions list, Add client on the clients list.
 */
export function fabFor(pathname: string): { href: string; label: string } | null {
  if (pathname === "/clients") return { href: "/clients/new", label: "Add client" }
  if (pathname === "/companies") return { href: "/companies/new", label: "Add company" }
  if (pathname === "/dashboard" || pathname === "/subscriptions")
    return { href: "/subscriptions/new", label: "Add subscription" }
  return null
}
