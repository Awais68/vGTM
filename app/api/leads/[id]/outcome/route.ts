import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace, unauthorized } from "@/lib/auth/get-current-user"
import { logActivity } from "@/lib/queue/service"
import { outcomeSchema } from "@/lib/validators/queue"
import { runTrigger } from "@/lib/automation/engine"
import type { LeadStatus } from "@prisma/client"

const STATUS_BY_OUTCOME: Record<string, LeadStatus> = {
  CONNECTION_ACCEPTED: "CONNECTED",
  REPLIED: "REPLIED",
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  MEETING_BOOKED: "INTERESTED",
  UNSUBSCRIBED: "NOT_INTERESTED",
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireWorkspace()
  if (!ctx) return unauthorized()

  const { id } = await params
  const parsed = outcomeSchema.safeParse(await request.json())

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input", code: "VALIDATION_ERROR" },
      { status: 400 }
    )
  }

  // Leads imported without a campaign are workspace-scoped directly, so both
  // paths have to be accepted here.
  const lead = await prisma.lead.findFirst({
    where: {
      id,
      OR: [{ workspaceId: ctx.workspaceId }, { campaign: { workspaceId: ctx.workspaceId } }],
    },
    select: { id: true, campaignId: true, connectedAt: true },
  })

  if (!lead) {
    return NextResponse.json({ success: false, error: "Lead not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const { outcome, note } = parsed.data
  const now = new Date()

  const updated = await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: STATUS_BY_OUTCOME[outcome],
      ...(outcome === "CONNECTION_ACCEPTED" && !lead.connectedAt ? { connectedAt: now } : {}),
      ...(outcome === "REPLIED" || outcome === "INTERESTED" || outcome === "NOT_INTERESTED"
        ? { repliedAt: now }
        : {}),
      ...(outcome === "UNSUBSCRIBED" ? { unsubscribed: true } : {}),
    },
  })

  await logActivity({
    workspaceId: ctx.workspaceId,
    leadId: lead.id,
    campaignId: lead.campaignId,
    type: outcome,
    note,
  })

  // A reply means the sequence should stop until a human decides what's next.
  if (outcome === "REPLIED" || outcome === "INTERESTED") {
    await prisma.sequenceEnrollment.updateMany({
      where: { leadId: lead.id, status: "ACTIVE" },
      data: { status: "NEEDS_REVIEW", nextSendAt: null },
    })
    await prisma.sendQueueItem.updateMany({
      where: { leadId: lead.id, status: { in: ["DRAFT", "READY"] } },
      data: { status: "SKIPPED", skipReason: "Lead replied — sequence paused" },
    })
  }

  if (outcome === "NOT_INTERESTED" || outcome === "UNSUBSCRIBED") {
    await prisma.sequenceEnrollment.updateMany({
      where: { leadId: lead.id },
      data: { status: "STOPPED", nextSendAt: null },
    })
    await prisma.sendQueueItem.updateMany({
      where: { leadId: lead.id, status: { in: ["DRAFT", "READY"] } },
      data: { status: "SKIPPED", skipReason: `Lead marked ${outcome}` },
    })
  }

  // Let automation react to what just happened (follow-up drafts after a
  // connection is accepted, hand-off rules after a reply, and so on).
  const automation = await runTrigger({
    workspaceId: ctx.workspaceId,
    trigger:
      outcome === "CONNECTION_ACCEPTED"
        ? "CONNECTION_ACCEPTED"
        : outcome === "REPLIED" || outcome === "INTERESTED"
          ? "REPLY_RECEIVED"
          : "LEAD_STATUS_CHANGED",
    campaignId: lead.campaignId,
    leadId: lead.id,
  }).catch(() => null)

  return NextResponse.json({ success: true, data: updated, automation })
}
