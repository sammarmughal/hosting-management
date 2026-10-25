"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { companySchema, type CompanyInput } from "@/lib/domain/validation"
import {
  checkFields,
  fieldProblems,
  invalid,
  numericId,
  refreshApp,
} from "@/lib/server/action-utils"
import { audit } from "@/lib/server/audit"
import { prisma } from "@/lib/server/db"
import { requireAdmin } from "@/lib/server/session"
import type { ActionResult } from "@/types/actions"

// Companies (docs/14 §3). After saving, the form returns to where it came from.

const returnTo = z.enum(["companies", "client"])
type ReturnTo = z.infer<typeof returnTo>

const TAKEN = "This client already has a company with this name"

const afterSave = (to: ReturnTo, clientId: number) =>
  to === "companies"
    ? "/companies?saved=company"
    : `/clients/${clientId}?tab=companies&saved=company`

/** Names are unique per client (the collation ignores case). */
async function nameTaken(clientId: number, name: string, exceptId?: number) {
  const found = await prisma.company.findFirst({
    where: { clientId, name, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  })
  return !!found
}

export async function createCompanyAction(
  input: CompanyInput,
  from: ReturnTo = "client"
): Promise<ActionResult> {
  await requireAdmin()
  const to = returnTo.safeParse(from)
  if (!to.success) return invalid()
  const parsed = companySchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const client = await prisma.client.findUnique({
    where: { id: parsed.data.clientId },
    select: { id: true },
  })
  if (!client) return fieldProblems({ clientId: "That client no longer exists" })
  if (await nameTaken(parsed.data.clientId, parsed.data.name))
    return fieldProblems({ name: TAKEN })
  const company = await prisma.company.create({ data: parsed.data })
  await audit("company.create", { entity: "company", entityId: company.id })
  refreshApp()
  redirect(afterSave(to.data, company.clientId))
}

export async function updateCompanyAction(
  id: number,
  input: CompanyInput,
  from: ReturnTo = "client"
): Promise<ActionResult> {
  await requireAdmin()
  const to = returnTo.safeParse(from)
  if (!numericId.safeParse(id).success || !to.success) return invalid()
  const parsed = companySchema.safeParse(input)
  if (!parsed.success) return checkFields(parsed.error)
  const current = await prisma.company.findUnique({
    where: { id },
    select: { clientId: true },
  })
  if (!current) return { ok: false, error: "Company not found." }
  // Its subscriptions belong to the client, so the client can't change.
  if (parsed.data.clientId !== current.clientId)
    return fieldProblems({ clientId: "A company can't move to another client" })
  if (await nameTaken(current.clientId, parsed.data.name, id))
    return fieldProblems({ name: TAKEN })
  await prisma.company.update({ where: { id }, data: parsed.data })
  await audit("company.update", { entity: "company", entityId: id })
  refreshApp()
  redirect(afterSave(to.data, current.clientId))
}

/** Deletes the company and, by cascade, its subscriptions and everything under them. */
export async function deleteCompanyAction(id: number): Promise<ActionResult> {
  await requireAdmin()
  if (!numericId.safeParse(id).success) return invalid()
  const { count } = await prisma.company.deleteMany({ where: { id } })
  if (!count) return { ok: false, error: "Company not found." }
  await audit("company.delete", { entity: "company", entityId: id })
  refreshApp()
  return { ok: true }
}
