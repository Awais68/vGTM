import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/auth/get-current-user"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await requireWorkspace()

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const { id } = await params

  const campaign = await prisma.campaign.findFirst({
    where: { id, workspaceId: dbUser.workspaceId },
    include: {
      leads: true,
      sequences: { include: { steps: { orderBy: { stepNumber: "asc" } } } },
    },
  })

  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found", code: "NOT_FOUND" }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: campaign })
}
