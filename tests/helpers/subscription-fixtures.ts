// A client with one subscription (and optionally a company), for integration
// tests (docs/14). Service types come from the migration (reset-db restores them).
import type { Prisma, PrismaClient } from "@/generated/prisma/client"

export async function serviceTypeId(prisma: PrismaClient, name = "Web Hosting") {
  return (await prisma.serviceType.findUniqueOrThrow({ where: { name } })).id
}

export async function clientWithSubscription(
  prisma: PrismaClient,
  input: {
    client: Omit<Prisma.ClientCreateInput, "companies" | "subscriptions" | "invoices">
    company?: {
      name: string
      email?: string | null
      phone?: string | null
      address?: string | null
    }
    subscription: Omit<
      Prisma.SubscriptionUncheckedCreateInput,
      "clientId" | "companyId" | "serviceTypeId"
    > & { serviceType?: string }
  }
) {
  const { serviceType, ...sub } = input.subscription
  const client = await prisma.client.create({ data: input.client })
  const company = input.company
    ? await prisma.company.create({ data: { ...input.company, clientId: client.id } })
    : null
  return prisma.subscription.create({
    data: {
      ...sub,
      clientId: client.id,
      companyId: company?.id ?? null,
      serviceTypeId: await serviceTypeId(prisma, serviceType),
    },
  })
}
