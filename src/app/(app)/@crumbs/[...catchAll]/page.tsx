// Matches every route without its own breadcrumb, so a client-side
// navigation from a detail page back to e.g. /dashboard clears the slot
// (unmatched slots keep their last content otherwise).
export default function NoCrumbs() {
  return null
}
