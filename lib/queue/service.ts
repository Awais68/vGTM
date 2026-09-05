import { addDays } from "date-fns"
import { prisma } from "@/lib/prisma"
import { QueueChannel, QueueStatus } from "@prisma/client"
import {
  draftConnectionNote,
  draftFollowUp,
  loadSenderContext,
  type SenderContext,
  type Tone,
} from "@/lib/ai/message-engine"
import { checkDailyLimit } from "./limits"

export interface GenerateOptions {
  workspaceId: string
  campaignId: string
  channel: QueueChannel
  stepNumber?: number
  limit?: number
  tone?: Tone
  senderName?: string
  offerContext?: string
}

export interface GenerateResult {
  created: number
  skipped: number
  failures: { leadId: string; reason: string }[]
}

/**
 * Drafts messages for every eligible lead in a campaign and parks them in the
 * queue as DRAFT. Nothing is sent here — a human reviews each one.
 */
export async function generateQueue(options: GenerateOptions): Promise<GenerateResult> {
  const {
    workspaceId,
    campaignId,
    channel,
    stepNumber = channel === "LINKEDIN_CONNECTION" ? 0 : 1,
    limit = 25,
  } = options

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { id: true, offerContext: true, fromName: true },
  })
  if (!campaign) throw new Error("Campaign not found")

  const sender: SenderContext = await loadSenderContext(workspaceId, {
    senderName: options.senderName ?? campaign.fromName ?? undefined,
    offerContext: options.offerContext ?? campaign.offerContext ?? undefined,
    tone: options.tone,
  })

  const leads = await prisma.lead.findMany({
    where: {
      campaignId,
      unsubscribed: false,
      status: { notIn: ["NOT_INTERESTED"] },
      // LinkedIn steps need a profile URL; a connection note only makes sense
      // for someone we haven't connected with yet.
      ...(channel === "LINKEDIN_CONNECTION"
        ? { linkedinUrl: { not: null }, connectedAt: null }
        : {}),
      ...(channel === "LINKEDIN_MESSAGE" ? { linkedinUrl: { not: null } } : {}),
      ...(channel === "EMAIL" ? { email: { not: null } } : {}),
      queueItems: { none: { channel, stepNumber } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      queueItems: {
        where: { status: "SENT" },
        orderBy: { stepNumber: "asc" },
        select: { content: true, stepNumber: true },
      },
    },
  })

  const result: GenerateResult = { created: 0, skipped: 0, failures: [] }

  for (const lead of leads) {
    try {
      const history = lead.queueItems.map((q) => q.content)

      const content =
        channel === "LINKEDIN_CONNECTION"
          ? await draftConnectionNote(workspaceId, lead, sender)
          : await draftFollowUp(workspaceId, lead, sender, stepNumber, history)

      await prisma.sendQueueItem.create({
        data: {
          workspaceId,
          leadId: lead.id,
          campaignId,
          channel,
          stepNumber,
          content,
          status: "DRAFT",
        },
      })

      await logActivity({
        workspaceId,
        leadId: lead.id,
        campaignId,
        type: "QUEUED",
        channel,
        stepNumber,
      })

      result.created++
    } catch (error) {
      result.failures.push({
        leadId: lead.id,
        reason: error instanceof Error ? error.message : "generation failed",
      })
    }
  }

  result.skipped = leads.length - result.created - result.failures.length
  return result
}

export async function regenerateItem(workspaceId: string, itemId: string, tone?: Tone) {
  const item = await prisma.sendQueueItem.findFirst({
    where: { id: itemId, workspaceId },
    include: { lead: true, campaign: { select: { offerContext: true, fromName: true } } },
  })
  if (!item) throw new Error("Queue item not found")
  if (item.status === "SENT") throw new Error("Already sent — cannot regenerate")

  const sender = await loadSenderContext(workspaceId, {
    senderName: item.campaign?.fromName ?? undefined,
    offerContext: item.campaign?.offerContext ?? undefined,
    tone,
  })

  const content =
    item.channel === "LINKEDIN_CONNECTION"
      ? await draftConnectionNote(workspaceId, item.lead, sender)
      : await draftFollowUp(workspaceId, item.lead, sender, item.stepNumber)

  return prisma.sendQueueItem.update({
    where: { id: item.id },
    data: { content, edited: false, status: "DRAFT" },
  })
}

/**
 * Called after the operator has actually sent the message in LinkedIn.
 * Records the fact, advances the lead, and schedules the next step's due date.
 */
export async function markSent(workspaceId: string, itemId: string) {
  const item = await prisma.sendQueueItem.findFirst({
    where: { id: itemId, workspaceId },
    include: {
      lead: {
        include: {
          enrollment: {
            include: { sequence: { include: { steps: { orderBy: { stepNumber: "asc" } } } } },
          },
        },
      },
    },
  })
  if (!item) throw new Error("Queue item not found")
  if (item.status === "SENT") return item

  const { allowed, usage } = await checkDailyLimit(workspaceId, item.channel)
  if (!allowed) {
    throw new Error(
      `Daily limit reached for ${item.channel} (${usage?.sentToday}/${usage?.limit}). ` +
        `Stop for today — raise the cap in Settings only if you know your account can take it.`
    )
  }

  const now = new Date()

  const [updated] = await prisma.$transaction([
    prisma.sendQueueItem.update({
      where: { id: item.id },
      data: { status: "SENT", sentAt: now },
    }),
    prisma.lead.update({
      where: { id: item.leadId },
      data: {
        lastTouchAt: now,
        status: item.lead.status === "NEW" ? "CONTACTED" : item.lead.status,
      },
    }),
    prisma.message.create({
      data: {
        leadId: item.leadId,
        content: item.content,
        type:
          item.channel === "LINKEDIN_CONNECTION"
            ? "LINKEDIN_CONNECTION"
            : item.channel === "LINKEDIN_MESSAGE"
              ? "LINKEDIN_MESSAGE"
              : "EMAIL",
        direction: "OUTBOUND",
        status: "SENT",
        sentAt: now,
      },
    }),
  ])

  await logActivity({
    workspaceId,
    leadId: item.leadId,
    campaignId: item.campaignId,
    type: "SENT",
    channel: item.channel,
    stepNumber: item.stepNumber,
  })

  if (item.campaignId) {
    await prisma.campaign.update({
      where: { id: item.campaignId },
      data: { sentCount: { increment: 1 } },
    })
  }

  // The cursor only moves when a human actually sends. The next step's own
  // delay decides when the cron should draft the follow-up.
  const enrollment = item.lead.enrollment
  if (enrollment && enrollment.status === "ACTIVE") {
    const nextStep = enrollment.sequence.steps[enrollment.currentStep + 1]

    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStep: enrollment.currentStep + 1,
        nextSendAt: nextStep ? addDays(now, nextStep.delayDays) : null,
        status: nextStep ? "ACTIVE" : "COMPLETED",
      },
    })
  }

  return updated
}

export async function skipItem(workspaceId: string, itemId: string, reason?: string) {
  const item = await prisma.sendQueueItem.findFirst({ where: { id: itemId, workspaceId } })
  if (!item) throw new Error("Queue item not found")

  const updated = await prisma.sendQueueItem.update({
    where: { id: item.id },
    data: { status: "SKIPPED", skipReason: reason ?? null },
  })

  await logActivity({
    workspaceId,
    leadId: item.leadId,
    campaignId: item.campaignId,
    type: "SKIPPED",
    channel: item.channel,
    stepNumber: item.stepNumber,
    note: reason,
  })

  return updated
}

export async function updateItem(
  workspaceId: string,
  itemId: string,
  data: { content?: string; status?: QueueStatus; scheduledFor?: Date | null }
) {
  const item = await prisma.sendQueueItem.findFirst({ where: { id: itemId, workspaceId } })
  if (!item) throw new Error("Queue item not found")
  if (item.status === "SENT") throw new Error("Already sent — cannot edit")

  return prisma.sendQueueItem.update({
    where: { id: item.id },
    data: {
      ...(data.content !== undefined ? { content: data.content, edited: true } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.scheduledFor !== undefined ? { scheduledFor: data.scheduledFor } : {}),
    },
  })
}

export async function logActivity(input: {
  workspaceId: string
  leadId?: string | null
  campaignId?: string | null
  type: import("@prisma/client").ActivityType
  channel?: QueueChannel | null
  stepNumber?: number | null
  note?: string | null
}) {
  return prisma.activity.create({
    data: {
      workspaceId: input.workspaceId,
      leadId: input.leadId ?? null,
      campaignId: input.campaignId ?? null,
      type: input.type,
      channel: input.channel ?? null,
      stepNumber: input.stepNumber ?? null,
      note: input.note ?? null,
    },
  })
}
