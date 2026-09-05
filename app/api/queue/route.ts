import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { getDailyUsage } from "@/lib/queue/limits"
import type { Prisma } from "@prisma/client"

export async function GET(request: NextRequest) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const params = request.nextUrl.searchParams
  const status = params.get("status")
  const channel = params.get("channel")
  const campaignId = params.get("campaignId")
  const take = Math.min(Number(params.get("limit") ?? 50), 200)

  const where: Prisma.SendQueueItemWhereInput = {
    workspaceId: ctx.workspaceId,
    ...(campaignId ? { campaignId } : {}),
    ...(channel ? { channel: channel as Prisma.EnumQueueChannelFilter["equals"] } : {}),
    status: status
      ? (status as "DRAFT" | "READY" | "SENT" | "SKIPPED")
      : { in: ["DRAFT", "READY"] },
  }

  const [items, usage, counts] = await Promise.all([
    prisma.sendQueueItem.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            jobTitle: true,
            linkedinUrl: true,
            email: true,
            status: true,
          },
        },
        campaign: { select: { id: true, name: true } },
      },
    }),
    getDailyUsage(ctx.workspaceId),
    prisma.sendQueueItem.groupBy({
      by: ["status"],
      where: { workspaceId: ctx.workspaceId },
      _count: { _all: true },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      items,
      usage,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    },
  })
}
