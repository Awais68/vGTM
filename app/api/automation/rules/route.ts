import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { createRuleSchema } from "@/lib/validators/automation"
import type { Prisma } from "@prisma/client"

export async function GET() {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const rules = await prisma.automationRule.findMany({
    where: { workspaceId: ctx.workspaceId },
    orderBy: [{ enabled: "desc" }, { priority: "asc" }, { createdAt: "desc" }],
    include: {
      campaign: { select: { id: true, name: true } },
      runs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  return NextResponse.json({ success: true, data: rules })
}

export async function POST(request: NextRequest) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const body = await request.json().catch(() => null)
  const parsed = createRuleSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid rule", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const { campaignId, conditions, actions, ...rest } = parsed.data

  if (campaignId) {
    const owned = await prisma.campaign.findFirst({
      where: { id: campaignId, workspaceId: ctx.workspaceId },
      select: { id: true },
    })
    if (!owned) {
      return NextResponse.json(
        { success: false, error: "Campaign not found", code: "CAMPAIGN_NOT_FOUND" },
        { status: 404 }
      )
    }
  }

  const rule = await prisma.automationRule.create({
    data: {
      workspaceId: ctx.workspaceId,
      campaignId: campaignId ?? null,
      conditions: (conditions ?? {}) as Prisma.InputJsonValue,
      actions: actions as unknown as Prisma.InputJsonValue,
      ...rest,
    },
  })

  return NextResponse.json({ success: true, data: rule }, { status: 201 })
}
