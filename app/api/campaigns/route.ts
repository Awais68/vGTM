import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/auth/get-current-user"
import { createCampaignSchema } from "@/lib/validators/campaigns"

export async function GET() {
  const dbUser = await requireWorkspace()

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: dbUser.workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      sentCount: true,
      totalCount: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ success: true, data: campaigns })
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
