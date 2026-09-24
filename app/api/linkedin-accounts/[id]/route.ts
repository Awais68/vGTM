import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { updateLinkedInAccountSchema } from "@/lib/validators/linkedin"
import { setDefaultAccount } from "@/lib/linkedin/accounts"
import type { Prisma } from "@prisma/client"

async function findOwned(workspaceId: string, id: string) {
  return prisma.linkedInAccount.findFirst({ where: { id, workspaceId } })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  const account = await findOwned(ctx.workspaceId, id)
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateLinkedInAccountSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  const { workingHours, isDefault, ...rest } = parsed.data

  const updated = await prisma.linkedInAccount.update({
    where: { id },
    data: {
      ...rest,
      ...(workingHours ? { workingHours: workingHours as unknown as Prisma.InputJsonValue } : {}),
      // Restarting a paused sender restarts its warm-up clock only if it never had one.
      ...(rest.warmupEnabled && !account.warmupStartAt ? { warmupStartAt: new Date() } : {}),
    },
  })

  if (isDefault) await setDefaultAccount(ctx.workspaceId, id)

  return NextResponse.json({ success: true, data: updated })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  const account = await findOwned(ctx.workspaceId, id)
  if (!account) {
    return NextResponse.json({ success: false, error: "Account not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const sent = await prisma.sendQueueItem.count({ where: { linkedInAccountId: id, status: "SENT" } })

  // Sent history is the analytics record — deleting the account would orphan
  // it, so a sender that has ever sent is disconnected rather than removed.
  if (sent > 0) {
    const updated = await prisma.linkedInAccount.update({
      where: { id },
      data: { status: "DISCONNECTED", isDefault: false },
    })
    return NextResponse.json({
      success: true,
      data: { ...updated, note: `Kept for history: ${sent} sent messages are attributed to this sender.` },
    })
  }

  await prisma.$transaction([
    prisma.sendQueueItem.updateMany({ where: { linkedInAccountId: id }, data: { linkedInAccountId: null } }),
    prisma.campaignSender.deleteMany({ where: { accountId: id } }),
    prisma.linkedInAccount.delete({ where: { id } }),
  ])

  return NextResponse.json({ success: true, data: { id } })
}
