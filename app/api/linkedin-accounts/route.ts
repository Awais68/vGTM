import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { createLinkedInAccountSchema } from "@/lib/validators/linkedin"
import {
  DEFAULT_WORKING_HOURS,
  effectiveLimit,
  getAccountCapacity,
  isWithinWorkingHours,
  setDefaultAccount,
  warmupFactor,
} from "@/lib/linkedin/accounts"
import type { Prisma } from "@prisma/client"

export async function GET() {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const [accounts, connectionCapacity, messageCapacity] = await Promise.all([
    prisma.linkedInAccount.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      include: { _count: { select: { campaigns: true } } },
    }),
    getAccountCapacity(ctx.workspaceId, "LINKEDIN_CONNECTION"),
    getAccountCapacity(ctx.workspaceId, "LINKEDIN_MESSAGE"),
  ])

  const byId = new Map(connectionCapacity.map((c) => [c.account.id, c]))
  const messageById = new Map(messageCapacity.map((c) => [c.account.id, c]))

  return NextResponse.json({
    success: true,
    data: accounts.map((account) => ({
      ...account,
      campaignCount: account._count.campaigns,
      warmupProgress: Math.round(warmupFactor(account) * 100),
      withinWorkingHours: isWithinWorkingHours(account),
      usage: {
        connection: {
          sentToday: byId.get(account.id)?.sentToday ?? 0,
          limit: effectiveLimit(account, "LINKEDIN_CONNECTION"),
          pending: byId.get(account.id)?.pending ?? 0,
        },
        message: {
          sentToday: messageById.get(account.id)?.sentToday ?? 0,
          limit: effectiveLimit(account, "LINKEDIN_MESSAGE"),
          pending: messageById.get(account.id)?.pending ?? 0,
        },
      },
    })),
  })
}

export async function POST(request: NextRequest) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const body = await request.json().catch(() => null)
  const parsed = createLinkedInAccountSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const { workingHours, isDefault, ...rest } = parsed.data

  const account = await prisma.linkedInAccount.create({
    data: {
      workspaceId: ctx.workspaceId,
      provider: "MANUAL",
      warmupStartAt: new Date(),
      workingHours: (workingHours ?? DEFAULT_WORKING_HOURS) as unknown as Prisma.InputJsonValue,
      ...rest,
    },
  })

  const count = await prisma.linkedInAccount.count({ where: { workspaceId: ctx.workspaceId } })
  if (isDefault || count === 1) await setDefaultAccount(ctx.workspaceId, account.id)

  return NextResponse.json({ success: true, data: account }, { status: 201 })
}
