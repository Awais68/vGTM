// Admin password is stored in .env.local as ADMIN_PANEL_PASSWORD — never hardcode it

import { cookies } from "next/headers"
import crypto from "node:crypto"

export async function checkAdminAuth(): Promise<boolean> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get("admin_session")

  if (!sessionCookie) return false

  const password = process.env.ADMIN_PANEL_PASSWORD
  const salt = process.env.ADMIN_SESSION_SALT

  if (!password || !salt) return false

  const expectedHash = crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex")

  try {
    const expected = Buffer.from(expectedHash)
    const actual = Buffer.from(sessionCookie.value)

    if (expected.byteLength !== actual.byteLength) return false

    return crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
