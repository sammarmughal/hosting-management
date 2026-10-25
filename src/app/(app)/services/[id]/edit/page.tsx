import { notFound, redirect } from "next/navigation"

// The old "Edit service" link (docs/14 §4).
export default async function OldEditServicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) notFound()
  redirect(`/subscriptions/${id}/edit`)
}
