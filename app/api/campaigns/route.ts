import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/auth/get-current-user"
import { createCampaignSchema } from "@/lib/validators/campaigns"

export async function GET() {
  const dbUser = await requireWorkspace()

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  // Progress is derived, never read from the denormalized Campaign.sentCount /
  // Campaign.totalCount columns. Those only move when a lead arrives through
  // the importer or a send succeeds, so a campaign that gained leads any other
  // way (or lost them) renders nonsense like "1 / 0".
  const [campaigns, sentPerCampaign] = await Promise.all([
    prisma.campaign.findMany({
      where: { workspaceId: dbUser.workspaceId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        _count: { select: { leads: true } },
      },
    }),
    prisma.sendQueueItem.groupBy({
      by: ["campaignId"],
      where: { workspaceId: dbUser.workspaceId, status: "SENT" },
      _count: { _all: true },
    }),
  ])

  const sentByCampaign = new Map(
    sentPerCampaign.map((row) => [row.campaignId, row._count._all])
  )

  const data = campaigns.map(({ _count, ...campaign }) => ({
    ...campaign,
    sentCount: sentByCampaign.get(campaign.id) ?? 0,
    totalCount: _count.leads,
  }))

  return NextResponse.json({ success: true, data })
}

export async function POST(request: NextRequest) {
  const dbUser = await requireWorkspace()

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createCampaignSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: parsed.data.name,
      offerContext: parsed.data.offerContext,
      fromName: parsed.data.fromName,
      fromEmail: parsed.data.fromEmail,
      workspaceId: dbUser.workspaceId,
      userId: dbUser.id,
    },
  })

  return NextResponse.json({ success: true, data: campaign })
}
