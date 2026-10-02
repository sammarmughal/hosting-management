// Phase 1: writes to the in-memory mock store (see mockStore in data.ts).
// Mirrors what the Prisma layer will do in Phases 4 and 7.
import { addOneYear, todayPK, type ISODate } from "@/lib/domain/dates"
import type { ClientData, RenewData, ServiceData } from "@/lib/domain/validation"
import {
  buildMockData,
  mockStore,
  type ClientSeed,
  type ServiceSeed,
} from "@/lib/mock/data"

function nextId() {
  return mockStore().nextId++
}

function findClient(id: number): ClientSeed | undefined {
  return mockStore().clients.find((c) => c.id === id)
}

function findService(
  id: number
): { client: ClientSeed; service: ServiceSeed } | undefined {
  for (const client of mockStore().clients) {
    const service = client.services.find((s) => s.id === id)
    if (service) return { client, service }
  }
  return undefined
}

function serviceSeed(id: number, s: ServiceData, prev?: ServiceSeed): ServiceSeed {
  return {
    ...prev,
    id,
    domain: s.domain,
    plan: s.planLabel,
    startDate: s.startDate,
    renewalDate: s.renewalDate,
    amount: s.chargeAmount,
    currency: s.currency,
    remindersEnabled: s.remindersEnabled,
    notes: s.notes,
  }
}

export function domainTaken(domain: string, exceptServiceId?: number): boolean {
  return mockStore().clients.some((c) =>
    c.services.some((s) => s.domain === domain && s.id !== exceptServiceId)
  )
}

export function createClientWithService(
  client: ClientData,
  service: ServiceData
): number {
  const id = nextId()
  mockStore().clients.push({ id, ...client, services: [serviceSeed(nextId(), service)] })
  return id
}

export function updateClient(id: number, client: ClientData): boolean {
  const c = findClient(id)
  if (!c) return false
  Object.assign(c, client)
  return true
}

export function deleteClient(id: number): boolean {
  const store = mockStore()
  const before = store.clients.length
  store.clients = store.clients.filter((c) => c.id !== id)
  return store.clients.length < before
}

export function createService(clientId: number, service: ServiceData): number | null {
  const c = findClient(clientId)
  if (!c) return null
  const id = nextId()
  c.services.push(serviceSeed(id, service))
  return id
}

export function updateService(id: number, service: ServiceData): number | null {
  const found = findService(id)
  if (!found) return null
  const i = found.client.services.indexOf(found.service)
  found.client.services[i] = serviceSeed(id, service, found.service)
  return found.client.id
}

export function toggleCancelService(id: number): "active" | "cancelled" | null {
  const found = findService(id)
  if (!found) return null
  const next = found.service.status === "cancelled" ? "active" : "cancelled"
  found.service.status = next
  found.service.remindersEnabled = next === "active"
  return next
}

export function deleteService(id: number): number | null {
  const found = findService(id)
  if (!found) return null
  found.client.services = found.client.services.filter((s) => s.id !== id)
  return found.client.id
}

/** docs/04 §6: record the payment, move the renewal date, skip the old cycle's reminders. */
export function renewService(input: RenewData): ISODate | null {
  const found = findService(input.serviceId)
  const current = buildMockData(new Date()).services.find((s) => s.id === input.serviceId)
  if (!found || !current) return null

  const store = mockStore()
  const from = input.extendFrom === "today" ? todayPK() : current.renewalDate
  const newRenewal = addOneYear(from)
  found.service.renewalDate = newRenewal
  found.service.startDate ??= current.startDate

  store.payments.push({
    id: nextId(),
    serviceId: input.serviceId,
    amount: input.amount,
    paidOn: input.paidOn,
    method: input.method,
    reference: input.reference || null,
    periodFrom: from,
    periodTo: newRenewal,
  })

  for (const r of buildMockData(new Date()).reminders) {
    if (
      r.serviceId === input.serviceId &&
      ["pending", "failed", "opened"].includes(r.status)
    ) {
      store.reminders.set(r.id, {
        status: "skipped",
        sentAt: r.sentAt,
        lastError: r.lastError,
      })
    }
  }
  return newRenewal
}

export function setReminder(
  id: string,
  status: "sent" | "opened" | "failed" | "skipped",
  extra: { sentAt?: string | null; lastError?: string | null } = {}
) {
  mockStore().reminders.set(id, { status, ...extra })
}

export function deletePayment(id: number): boolean {
  const store = mockStore()
  const exists = buildMockData(new Date()).payments.some((p) => p.id === id)
  if (!exists) return false
  store.payments = store.payments.filter((p) => p.id !== id)
  store.deletedPayments.add(id)
  return true
}

export function markNotificationsRead(ids: readonly string[]) {
  const read = mockStore().readNotifications
  for (const id of ids) read.add(id)
}
