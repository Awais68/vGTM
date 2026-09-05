import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { skipItem } from "@/lib/queue/service"
import { skipSchema } from "@/lib/validators/queue"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = skipSchema.safeParse(body)

  try {
    const item = await skipItem(ctx.workspaceId, id, parsed.success ? parsed.data.reason : undefined)
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Skip failed"
    return NextResponse.json({ success: false, error: message, code: "QUEUE_ERROR" }, { status: 400 })
  }
}
