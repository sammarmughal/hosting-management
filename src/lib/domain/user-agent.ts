// "Chrome · Windows" for the Recent logins table. Rough on purpose: it only
// helps the admin recognise their own devices.

const BROWSERS: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/Firefox\//, "Firefox"],
  [/Chrome\/|CriOS/, "Chrome"],
  [/Safari\//, "Safari"],
]
const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "Mac"],
  [/Linux/, "Linux"],
]

export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return "Unknown device"
  const browser = BROWSERS.find(([re]) => re.test(ua))?.[1]
  const system = SYSTEMS.find(([re]) => re.test(ua))?.[1]
  return [browser, system].filter(Boolean).join(" · ") || "Unknown device"
}
