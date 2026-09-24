/**
 * Public base URL of this deployment, with surrounding whitespace and any
 * trailing slash removed. A stray space in the env var (easy to add when
 * pasting into a dashboard) would otherwise break every unsubscribe link and
 * signup redirect built from it.
 */
export function getAppUrl(fallback = "http://localhost:3000"): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const base = raw && raw.length > 0 ? raw : fallback
  return base.replace(/\/+$/, "")
}
