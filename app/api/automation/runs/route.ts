import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"

export async function GET(request: NextRequest) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const take = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 30), 100)
  const ruleId = request.nextUrl.searchParams.get("ruleId")

  const runs = await prisma.automationRun.findMany({
    where: { workspaceId: ctx.workspaceId, ...(ruleId ? { ruleId } : {}) },
    orderBy: { createdAt: "desc" },
    take,
    include: { rule: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ success: true, data: runs })
}
