/** Browser-only file download; used by recovery codes and import templates. */
export function downloadText(text: string, filename: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
