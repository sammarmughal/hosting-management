import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export default function NewSubscriptionCrumbs() {
  return (
    <Breadcrumbs
      items={[
        { label: "Subscriptions", href: "/subscriptions" },
        { label: "Add subscription" },
      ]}
    />
  )
}
