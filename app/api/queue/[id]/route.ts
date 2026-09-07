import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { updateItem } from "@/lib/queue/service"
import { updateQueueItemSchema } from "@/lib/validators/queue"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  const parsed = updateQueueItemSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  try {
    const item = await updateItem(ctx.workspaceId, id, {
      content: parsed.data.content,
      subject: parsed.data.subject,
      status: parsed.data.status,
      scheduledFor:
        parsed.data.scheduledFor === undefined
          ? undefined
          : parsed.data.scheduledFor === null
            ? null
            : new Date(parsed.data.scheduledFor),
    })
    return NextResponse.json({ success: true, data: item })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed"
    return NextResponse.json({ success: false, error: message, code: "QUEUE_ERROR" }, { status: 400 })
  }
}
