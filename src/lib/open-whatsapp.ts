/**
 * Opens a prepared wa.me link in a new tab. Call it synchronously inside the
 * click handler, before any await: browsers only allow pop-ups that come
 * straight from a user gesture. The URL is built on the server beforehand.
 * Returns false if the browser blocked it anyway.
 */
export function openWhatsApp(url: string): boolean {
  const win = window.open(url, "_blank")
  if (!win) return false
  // Same effect as rel="noopener": the new tab can't reach this page.
  win.opener = null
  return true
}
