import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { settingsSchema } from "@/lib/validators/queue"

export async function GET() {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const setting = await prisma.workspaceSetting.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: { workspaceId: ctx.workspaceId },
    update: {},
    select: {
      senderName: true,
      senderTitle: true,
      defaultContext: true,
      defaultTone: true,
      dailyConnectionLimit: true,
      dailyMessageLimit: true,
      aiProvider: true,
      aiModel: true,
    },
  })

  return NextResponse.json({ success: true, data: setting })
}

export async function PATCH(request: NextRequest) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const parsed = settingsSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const setting = await prisma.workspaceSetting.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: { workspaceId: ctx.workspaceId, ...parsed.data },
    update: parsed.data,
  })

  return NextResponse.json({ success: true, data: setting })
}
