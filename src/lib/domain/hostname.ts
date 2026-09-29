// Domain normalisation (docs/04 §8, docs/10 §2: "https://www.Example.com/" → "example.com").

const HOSTNAME_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.[a-z0-9-]{1,63})+$/

/** Lower-cases and strips the scheme, "www.", any path, query, port and trailing dot. */
export function normaliseDomain(input: string): string {
  let s = input.trim().toLowerCase()
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "") // https://, http://, ftp://
  s = s.replace(/[/?#].*$/, "") // path, query, fragment
  s = s.replace(/:\d+$/, "") // port
  s = s.replace(/\.$/, "")
  s = s.replace(/^www\./, "")
  return s
}

export function isValidDomain(domain: string): boolean {
  return domain.length <= 253 && HOSTNAME_RE.test(domain)
}
