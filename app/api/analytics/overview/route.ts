import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { getDailySeries, getFunnel, getLeadStatusBreakdown, getStepBreakdown } from "@/lib/analytics/stats"
import { getDailyUsage } from "@/lib/queue/limits"

export async function GET(request: NextRequest) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const days = Math.min(Number(request.nextUrl.searchParams.get("days") ?? 30), 90)

  const [funnel, series, steps, statuses, usage] = await Promise.all([
    getFunnel(ctx.workspaceId),
    getDailySeries(ctx.workspaceId, days),
    getStepBreakdown(ctx.workspaceId),
    getLeadStatusBreakdown(ctx.workspaceId),
    getDailyUsage(ctx.workspaceId),
  ])

  return NextResponse.json({
    success: true,
    data: { funnel, series, steps, statuses, usage },
  })
}
