import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { getSubscription } from "@/lib/data"

export default async function EditSubscriptionCrumbs({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const s = await getSubscription(Number((await params).id))
  if (!s) return null
  return (
    <Breadcrumbs
      items={[
        { label: "Subscriptions", href: "/subscriptions" },
        { label: s.clientName, href: `/clients/${s.clientId}?tab=subscriptions` },
        { label: "Edit subscription" },
      ]}
    />
  )
}
