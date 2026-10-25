import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export default function NewCompanyCrumbs() {
  return (
    <Breadcrumbs
      items={[{ label: "Companies", href: "/companies" }, { label: "Add company" }]}
    />
  )
}
