"use server"

import { bigId, invalid, refreshApp } from "@/lib/server/action-utils"
import { prisma } from "@/lib/server/db"
import { listNotifications } from "@/lib/server/queries"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"
import type { NotificationItem } from "@/types/view"

/** Called when the bell opens (no polling, docs/09 Phase 5). */
export async function getLatestNotificationsAction(): Promise<
  ActionResult<{ unread: number; items: NotificationItem[] }>
> {
  await requireAdmin()
  const { unread, items } = await listNotifications(10)
  return { ok: true, data: { unread, items } }
}

export async function markReadAction(id: string): Promise<ActionResult> {
  await requireAdmin()
  const parsed = bigId.safeParse(id)
  if (!parsed.success) return invalid()
  await prisma.notification.updateMany({ where: { id: parsed.data }, data: { isRead: true } })
  refreshApp()
  return { ok: true }
}

export async function markAllReadAction(): Promise<ActionResult> {
  await requireAdmin()
  await prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } })
  refreshApp()
  return { ok: true }
}
