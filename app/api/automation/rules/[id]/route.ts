import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { updateRuleSchema } from "@/lib/validators/automation"
import type { Prisma } from "@prisma/client"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  const rule = await prisma.automationRule.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
  if (!rule) {
    return NextResponse.json({ success: false, error: "Rule not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid rule", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const { conditions, actions, campaignId, ...rest } = parsed.data

  const updated = await prisma.automationRule.update({
    where: { id },
    data: {
      ...rest,
      ...(campaignId !== undefined ? { campaignId: campaignId ?? null } : {}),
      ...(conditions !== undefined ? { conditions: conditions as Prisma.InputJsonValue } : {}),
      ...(actions !== undefined ? { actions: actions as unknown as Prisma.InputJsonValue } : {}),
    },
  })

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  const rule = await prisma.automationRule.findFirst({ where: { id, workspaceId: ctx.workspaceId } })
  if (!rule) {
    return NextResponse.json({ success: false, error: "Rule not found", code: "NOT_FOUND" }, { status: 404 })
  }

  await prisma.automationRule.delete({ where: { id } })
  return NextResponse.json({ success: true, data: { id } })
}
