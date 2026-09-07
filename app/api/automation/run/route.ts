import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { runNowSchema } from "@/lib/validators/automation"
import { runTrigger } from "@/lib/automation/engine"
import { runAutopilot } from "@/lib/automation/scheduler"

export const maxDuration = 300

/**
 * "Run now" from the UI. With a trigger it fires those rules; without one it
 * runs the full autopilot pass for this workspace, ignoring the schedule
 * window because the operator asked for it explicitly.
 */
export async function POST(request: NextRequest) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const body = await request.json().catch(() => ({}))
  const parsed = runNowSchema.safeParse(body ?? {})
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  try {
    if (parsed.data.trigger) {
      const result = await runTrigger({
        workspaceId: ctx.workspaceId,
        trigger: parsed.data.trigger,
        campaignId: parsed.data.campaignId ?? null,
        ignoreSchedule: true,
      })
      return NextResponse.json({ success: true, data: result })
    }

    const result = await runAutopilot(ctx.workspaceId)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Automation run failed"
    return NextResponse.json({ success: false, error: message, code: "RUN_FAILED" }, { status: 500 })
  }
}
