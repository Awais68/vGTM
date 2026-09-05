import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/auth/get-current-user"
import { saveSequenceSchema } from "@/lib/validators/campaigns"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await requireWorkspace()

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const { id: campaignId } = await params

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: dbUser.workspaceId },
  })

  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const body = await request.json()
  const parsed = saveSequenceSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const existing = await prisma.sequence.findFirst({ where: { campaignId } })

  const sequence = await prisma.$transaction(async (tx) => {
    const seq = existing
      ? await tx.sequence.update({ where: { id: existing.id }, data: { name: parsed.data.name } })
      : await tx.sequence.create({ data: { name: parsed.data.name, campaignId } })

    await tx.sequenceStep.deleteMany({ where: { sequenceId: seq.id } })
    await tx.sequenceStep.createMany({
      data: parsed.data.steps.map((step) => ({ ...step, sequenceId: seq.id })),
    })

    return tx.sequence.findUniqueOrThrow({
      where: { id: seq.id },
      include: { steps: { orderBy: { stepNumber: "asc" } } },
    })
  })

  return NextResponse.json({ success: true, data: sequence })
}
