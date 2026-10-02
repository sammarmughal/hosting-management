type SearchParams = Record<string, string | string[] | undefined>

/** Rebuilds `path?query` from page searchParams with a patch applied ("" / null removes a key). */
export function hrefWith(
  path: string,
  sp: SearchParams,
  patch: Record<string, string | number | null | undefined>
): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v
    if (value) qs.set(k, value)
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "" || (k === "page" && v === 1))
      qs.delete(k)
    else qs.set(k, String(v))
  }
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}
