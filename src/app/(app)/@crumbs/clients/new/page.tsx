import { Breadcrumbs } from "@/components/layout/breadcrumbs"

export default function NewClientCrumbs() {
  return (
    <Breadcrumbs
      items={[{ label: "Clients", href: "/clients" }, { label: "Add client" }]}
    />
  )
}
