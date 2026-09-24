import { addDays } from "date-fns"
import { prisma } from "@/lib/prisma"
import { QueueChannel, QueueStatus } from "@prisma/client"
import {
  draftConnectionNote,
  draftEmail,
  draftFollowUp,
  loadSenderContext,
  type SenderContext,
  type Tone,
} from "@/lib/ai/message-engine"
import { checkDailyLimit } from "./limits"
import { sendOutreachEmail } from "@/lib/email/send"
import { effectiveLimit, pickSenderAccount } from "@/lib/linkedin/accounts"

export interface GenerateOptions {
  workspaceId: string
  campaignId: string
  channel: QueueChannel
  stepNumber?: number
  limit?: number
  tone?: Tone
  senderName?: string
  offerContext?: string
  /** Rotate the drafts across the workspace's LinkedIn sender accounts. */
  assignSender?: boolean
  /** Pin the drafts to one sender (the account picked in the header). */
  linkedInAccountId?: string | null
  /** Generate outside a sender's working hours (manual runs from the UI). */
  ignoreSchedule?: boolean
}

export interface GenerateResult {
  created: number
  skipped: number
  failures: { leadId: string; reason: string }[]
  /** True when generation stopped early because every sender is at its cap. */
  blockedByCapacity: boolean
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
    assignSender = false,
    ignoreSchedule = false,
    linkedInAccountId: pinnedAccountId = null,
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

  const result: GenerateResult = { created: 0, skipped: 0, failures: [], blockedByCapacity: false }

  for (const lead of leads) {
    try {
      // Reserve a sender before spending an AI call: drafting messages no
      // account has room to send just creates queue debt.
      let linkedInAccountId: string | null = null
      if ((assignSender || pinnedAccountId) && channel !== "EMAIL") {
        const picked = await pickSenderAccount({
          workspaceId,
          channel,
          campaignId,
          accountId: pinnedAccountId,
          ignoreSchedule,
        })
        if (!picked) {
          result.blockedByCapacity = true
          break
        }
        linkedInAccountId = picked.accountId
      }

      const history = lead.queueItems.map((q) => q.content)

      // Email needs its own subject line, so it gets its own drafter — a
      // LinkedIn follow-up body sent as an email arrives without a subject.
      const draft = await draftForChannel({
        workspaceId,
        channel,
        lead,
        sender,
        stepNumber,
        history,
      })

      await prisma.sendQueueItem.create({
        data: {
          workspaceId,
          leadId: lead.id,
          campaignId,
          channel,
          stepNumber,
          subject: draft.subject,
          content: draft.content,
          linkedInAccountId,
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

interface DraftInput {
  workspaceId: string
  channel: QueueChannel
  lead: Parameters<typeof draftConnectionNote>[1]
  sender: SenderContext
  stepNumber: number
  history?: string[]
}

/** One place that decides which drafter a channel gets. */
async function draftForChannel({
  workspaceId,
  channel,
  lead,
  sender,
  stepNumber,
  history = [],
}: DraftInput): Promise<{ subject: string | null; content: string }> {
  if (channel === "LINKEDIN_CONNECTION") {
    return { subject: null, content: await draftConnectionNote(workspaceId, lead, sender) }
  }

  if (channel === "EMAIL") {
    const email = await draftEmail(workspaceId, lead, sender, stepNumber, history)
    return { subject: email.subject, content: email.body }
  }

  return {
    subject: null,
    content: await draftFollowUp(workspaceId, lead, sender, stepNumber, history),
  }
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

  const draft = await draftForChannel({
    workspaceId,
    channel: item.channel,
    lead: item.lead,
    sender,
    stepNumber: item.stepNumber,
  })

  return prisma.sendQueueItem.update({
    where: { id: item.id },
    data: { subject: draft.subject, content: draft.content, edited: false, status: "DRAFT" },
  })
}

/**
 * LinkedIn items: called after the operator has actually sent the message in
 * LinkedIn. EMAIL items: sends the email through Resend right here, and only
 * marks the item SENT if delivery was accepted.
 * Either way it records the fact, advances the lead, and schedules the next
 * step's due date.
 */
export async function markSent(workspaceId: string, itemId: string) {
  const item = await prisma.sendQueueItem.findFirst({
    where: { id: itemId, workspaceId },
    include: {
      campaign: { select: { name: true, fromName: true, fromEmail: true } },
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

  // When the draft is bound to a sender account, that account's own cap is
  // the one that matters — a workspace-wide number would let one profile
  // absorb everyone else's headroom.
  if (item.linkedInAccountId && item.channel !== "EMAIL") {
    const account = await prisma.linkedInAccount.findUnique({ where: { id: item.linkedInAccountId } })
    if (account) {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const sentToday = await prisma.sendQueueItem.count({
        where: {
          linkedInAccountId: account.id,
          channel: item.channel,
          status: "SENT",
          sentAt: { gte: startOfDay },
        },
      })
      const cap = effectiveLimit(account, item.channel)

      if (sentToday >= cap) {
        throw new Error(
          `${account.name} has hit today's ${item.channel} cap (${sentToday}/${cap}). ` +
            `Switch to another sender or continue tomorrow.`
        )
      }
    }
  } else {
    const { allowed, usage } = await checkDailyLimit(workspaceId, item.channel)
    if (!allowed) {
      throw new Error(
        `Daily limit reached for ${item.channel} (${usage?.sentToday}/${usage?.limit}). ` +
          `Stop for today — raise the cap in Settings only if you know your account can take it.`
      )
    }
  }

  // An email draft is sent by us, not copied out by a human. A failed send
  // leaves the item in the queue so the operator can see and retry it.
  if (item.channel === "EMAIL") {
    if (!item.lead.email) throw new Error("This lead has no email address")

    const fromEmail = item.campaign?.fromEmail ?? process.env.RESEND_FROM_EMAIL
    if (!fromEmail) {
      throw new Error("No sender address: set the campaign's from email or RESEND_FROM_EMAIL")
    }

    const result = await sendOutreachEmail({
      toEmail: item.lead.email,
      toName: item.lead.firstName,
      fromName: item.campaign?.fromName ?? "Outreach Team",
      fromEmail,
      subject: item.subject?.trim() || item.campaign?.name || `quick question, ${item.lead.firstName}`,
      messageContent: item.content,
      leadId: item.leadId,
      workspaceId,
    })

    if (!result.success) {
      throw new Error(`Email not sent: ${result.error ?? "provider rejected the message"}`)
    }
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
    // sendOutreachEmail() already wrote the EMAIL message row (with the Resend
    // id); LinkedIn sends are logged here because nothing else sees them.
    ...(item.channel === "EMAIL"
      ? []
      : [
          prisma.message.create({
            data: {
              leadId: item.leadId,
              content: item.content,
              type: item.channel === "LINKEDIN_CONNECTION" ? "LINKEDIN_CONNECTION" : "LINKEDIN_MESSAGE",
              direction: "OUTBOUND",
              status: "SENT",
              sentAt: now,
            },
          }),
        ]),
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
  data: {
    content?: string
    subject?: string | null
    status?: QueueStatus
    scheduledFor?: Date | null
  }
) {
  const item = await prisma.sendQueueItem.findFirst({ where: { id: itemId, workspaceId } })
  if (!item) throw new Error("Queue item not found")
  if (item.status === "SENT") throw new Error("Already sent — cannot edit")

  return prisma.sendQueueItem.update({
    where: { id: item.id },
    data: {
      ...(data.content !== undefined ? { content: data.content, edited: true } : {}),
      ...(data.subject !== undefined ? { subject: data.subject, edited: true } : {}),
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
