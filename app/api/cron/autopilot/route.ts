import { NextRequest, NextResponse } from "next/server"
import { runAutopilotForAllWorkspaces } from "@/lib/automation/scheduler"

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const results = await runAutopilotForAllWorkspaces()

  return NextResponse.json({
    success: true,
    data: {
      workspaces: results.length,
      drafted: results.reduce((sum, r) => sum + r.topUp.reduce((s, t) => s + t.created, 0), 0),
      results,
    },
  })
}
