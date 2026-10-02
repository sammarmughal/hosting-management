/** Title + one-line description at the top of an auth card. */
export function AuthHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-1 text-sm text-ink-muted">{description}</p>
    </div>
  )
}
