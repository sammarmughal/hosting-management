import { redirect } from "next/navigation"

// The old "Add service" link (docs/14 §4).
export default async function OldNewServicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const id = Number((await params).id)
  redirect(
    Number.isInteger(id) && id > 0
      ? `/subscriptions/new?clientId=${id}`
      : "/subscriptions/new"
  )
}
