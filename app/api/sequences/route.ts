import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"

/**
 * Sequences hang off campaigns, but automation rules need to pick one from a
 * flat list, so this returns every sequence in the workspace.
 */
export async function GET(request: NextRequest) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const campaignId = request.nextUrl.searchParams.get("campaignId")

  const sequences = await prisma.sequence.findMany({
    where: {
      campaign: { workspaceId: ctx.workspaceId },
      ...(campaignId ? { campaignId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      campaignId: true,
      campaign: { select: { name: true } },
      _count: { select: { steps: true, enrollments: true } },
    },
  })

  return NextResponse.json({
    success: true,
    data: sequences.map((sequence) => ({
      id: sequence.id,
      name: `${sequence.name} (${sequence.campaign.name})`,
      campaignId: sequence.campaignId,
      stepCount: sequence._count.steps,
      enrollmentCount: sequence._count.enrollments,
    })),
  })
}
