import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { campaignSendersSchema } from "@/lib/validators/linkedin"

async function ownedCampaign(campaignId: string, workspaceId: string) {
  return prisma.campaign.findFirst({ where: { id: campaignId, workspaceId }, select: { id: true } })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  if (!(await ownedCampaign(id, ctx.workspaceId))) {
    return NextResponse.json({ success: false, error: "Campaign not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const senders = await prisma.campaignSender.findMany({
    where: { campaignId: id },
    select: { accountId: true },
  })

  return NextResponse.json({ success: true, data: senders.map((s) => s.accountId) })
}

/**
 * Replaces the campaign's sender list. An empty list means "any active sender",
 * which is how a campaign behaves before anyone picks.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  if (!(await ownedCampaign(id, ctx.workspaceId))) {
    return NextResponse.json({ success: false, error: "Campaign not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const parsed = campaignSendersSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  // Only accounts this workspace owns can be attached.
  const owned = await prisma.linkedInAccount.findMany({
    where: { workspaceId: ctx.workspaceId, id: { in: parsed.data.accountIds } },
    select: { id: true },
  })

  await prisma.$transaction([
    prisma.campaignSender.deleteMany({ where: { campaignId: id } }),
    prisma.campaignSender.createMany({
      data: owned.map((account) => ({ campaignId: id, accountId: account.id })),
      skipDuplicates: true,
    }),
  ])

  return NextResponse.json({ success: true, data: owned.map((a) => a.id) })
}
