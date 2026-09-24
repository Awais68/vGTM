import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/auth/get-current-user"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await requireWorkspace()

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const { id: leadId } = await params
  const body = await request.json().catch(() => ({}))
  const action = body?.action

  if (action !== "resume" && action !== "stop") {
    return NextResponse.json(
      { success: false, error: "action must be 'resume' or 'stop'", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, campaign: { workspaceId: dbUser.workspaceId } },
    include: { enrollment: true },
  })

  if (!lead || !lead.enrollment || lead.enrollment.status !== "NEEDS_REVIEW") {
    return NextResponse.json(
      { success: false, error: "Lead not found or not pending review", code: "NOT_FOUND" },
      { status: 404 }
    )
  }

  const enrollment = await prisma.sequenceEnrollment.update({
    where: { id: lead.enrollment.id },
    data:
      action === "resume"
        ? { status: "ACTIVE", nextSendAt: new Date() }
        : { status: "STOPPED", nextSendAt: null },
  })

  return NextResponse.json({ success: true, data: enrollment })
}
