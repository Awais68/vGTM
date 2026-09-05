import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { generateQueue } from "@/lib/queue/service"
import { generateQueueSchema } from "@/lib/validators/queue"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const parsed = generateQueueSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  try {
    const result = await generateQueue({ workspaceId: ctx.workspaceId, ...parsed.data })

    // Every lead failed — surface the real reason (usually a missing AI key)
    // instead of reporting an empty but "successful" run.
    if (result.created === 0 && result.failures.length > 0) {
      return NextResponse.json(
        { success: false, error: result.failures[0].reason, code: "AI_ERROR", data: result },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed"
    return NextResponse.json({ success: false, error: message, code: "AI_ERROR" }, { status: 500 })
  }
}
