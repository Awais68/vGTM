import { NextResponse } from "next/server"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { markSent } from "@/lib/queue/service"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params

  try {
    const item = await markSent(ctx.workspaceId, id)
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not mark as sent"
    return NextResponse.json(
      { success: false, error: message, code: "LIMIT_OR_STATE" },
      { status: 400 }
    )
  }
}
