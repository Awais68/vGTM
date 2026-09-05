import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { regenerateItem } from "@/lib/queue/service"
import type { Tone } from "@/lib/ai/message-engine"

export const maxDuration = 60

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as { tone?: Tone }

  try {
    const item = await regenerateItem(ctx.workspaceId, id, body.tone)
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Regeneration failed"
    return NextResponse.json({ success: false, error: message, code: "AI_ERROR" }, { status: 400 })
  }
}
