import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/auth/get-current-user"

export async function GET(request: NextRequest) {
  const dbUser = await requireWorkspace()

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const campaignId = request.nextUrl.searchParams.get("campaignId")

  if (!campaignId) {
    return NextResponse.json(
      { success: false, error: "campaignId query param is required", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: dbUser.workspaceId },
    select: { id: true },
  })

  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const leads = await prisma.lead.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: {
      enrollment: {
        select: { status: true, currentStep: true, nextSendAt: true },
      },
    },
  })

  return NextResponse.json({ success: true, data: leads })
}
