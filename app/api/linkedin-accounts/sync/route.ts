import { NextResponse } from "next/server"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { syncHeyReachAccounts } from "@/lib/linkedin/accounts"

export const maxDuration = 60

/** Pulls the sender list from HeyReach. Local limits/schedules are preserved. */
export async function POST() {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  try {
    const result = await syncHeyReachAccounts(ctx.workspaceId)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed"
    return NextResponse.json({ success: false, error: message, code: "SYNC_FAILED" }, { status: 502 })
  }
}
