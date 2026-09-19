import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { getDailySeries, getFunnel, getLeadStatusBreakdown, getStepBreakdown } from "@/lib/analytics/stats"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: {
      id: true,
      name: true,
      status: true,
      offerContext: true,
      createdAt: true,
      _count: { select: { leads: true } },
    },
  })

  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const [funnel, series, steps, statuses, sentCount] = await Promise.all([
    getFunnel(ctx.workspaceId, id),
    getDailySeries(ctx.workspaceId, 30, id),
    getStepBreakdown(ctx.workspaceId, id),
    getLeadStatusBreakdown(ctx.workspaceId, id),
    // Derived, for the same reason as /api/campaigns: the stored counters drift.
    prisma.sendQueueItem.count({ where: { campaignId: id, status: "SENT" } }),
  ])

  const { _count, ...rest } = campaign

  return NextResponse.json({
    success: true,
    data: {
      campaign: { ...rest, sentCount, totalCount: _count.leads },
      funnel,
      series,
      steps,
      statuses,
    },
  })
}
