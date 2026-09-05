import { addDays } from "date-fns"
import { prisma } from "@/lib/prisma"
import { sendOutreachEmail } from "@/lib/email/send"
import { draftConnectionNote, draftFollowUp, loadSenderContext } from "@/lib/ai/message-engine"
import { logActivity } from "@/lib/queue/service"

/** A step template of exactly this value means "let the AI write it". */
export const AI_TEMPLATE_MARKER = "{{ai}}"

interface MergeableLead {
  firstName: string
  lastName: string | null
  company: string | null
  jobTitle: string | null
}

const MERGE_TAG_PATTERN = /\{\{\s*(\w+)\s*\}\}/g

export function renderTemplate(template: string, lead: MergeableLead): string {
  const values: Record<string, string> = {
    firstName: lead.firstName,
    lastName: lead.lastName ?? "",
    company: lead.company ?? "your company",
    jobTitle: lead.jobTitle ?? "",
  }
  return template.replace(MERGE_TAG_PATTERN, (_, key: string) => values[key] ?? "")
}

export async function enrollLead(leadId: string, sequenceId: string) {
  return prisma.sequenceEnrollment.upsert({
    where: { leadId },
    create: { leadId, sequenceId, currentStep: 0, status: "ACTIVE", nextSendAt: new Date() },
    update: { sequenceId, currentStep: 0, status: "ACTIVE", nextSendAt: new Date() },
  })
}

export type ProcessResult =
  | { outcome: "sent" }
  | { outcome: "queued" }
  | { outcome: "completed" }
  | { outcome: "skipped"; reason: string }

export async function processDueStep(enrollmentId: string): Promise<ProcessResult> {
  const enrollment = await prisma.sequenceEnrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      lead: true,
      sequence: {
        include: {
          steps: { orderBy: { stepNumber: "asc" } },
          campaign: true,
        },
      },
    },
  })

  if (!enrollment) return { outcome: "skipped", reason: "not_found" }
  if (enrollment.status !== "ACTIVE") return { outcome: "skipped", reason: "not_active" }

  if (enrollment.lead.unsubscribed) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "STOPPED", nextSendAt: null },
    })
    return { outcome: "skipped", reason: "unsubscribed" }
  }

  const steps = enrollment.sequence.steps
  const step = steps[enrollment.currentStep]

  if (!step) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "COMPLETED", nextSendAt: null },
    })
    return { outcome: "completed" }
  }

  const nextStep = steps[enrollment.currentStep + 1]
  const advance = (status: "ACTIVE" | "COMPLETED" | "STOPPED") =>
    prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStep: enrollment.currentStep + 1,
        nextSendAt: status === "ACTIVE" && nextStep ? addDays(new Date(), nextStep.delayDays) : null,
        status,
      },
    })

  const campaign = enrollment.sequence.campaign

  // LinkedIn steps can't be automated — draft them into the Send Queue and wait
  // for a human. The cursor stays put; markSent() moves it once they actually send.
  if (step.type === "CONNECTION_REQUEST" || step.type === "LINKEDIN_MESSAGE") {
    if (!enrollment.lead.linkedinUrl) {
      await advance(nextStep ? "ACTIVE" : "COMPLETED")
      return { outcome: "skipped", reason: "no_linkedin_url" }
    }

    const channel = step.type === "CONNECTION_REQUEST" ? "LINKEDIN_CONNECTION" : "LINKEDIN_MESSAGE"

    const existing = await prisma.sendQueueItem.findUnique({
      where: {
        leadId_channel_stepNumber: {
          leadId: enrollment.leadId,
          channel,
          stepNumber: step.stepNumber,
        },
      },
    })

    if (existing) {
      await prisma.sequenceEnrollment.update({
        where: { id: enrollmentId },
        data: { nextSendAt: null },
      })
      return { outcome: "skipped", reason: "already_queued" }
    }

    let content = renderTemplate(step.template, enrollment.lead)

    if (step.template.trim() === AI_TEMPLATE_MARKER) {
      const sender = await loadSenderContext(campaign.workspaceId, {
        senderName: campaign.fromName ?? undefined,
        offerContext: campaign.offerContext ?? undefined,
      })
      content =
        channel === "LINKEDIN_CONNECTION"
          ? await draftConnectionNote(campaign.workspaceId, enrollment.lead, sender)
          : await draftFollowUp(campaign.workspaceId, enrollment.lead, sender, step.stepNumber)
    }

    await prisma.sendQueueItem.create({
      data: {
        workspaceId: campaign.workspaceId,
        leadId: enrollment.leadId,
        campaignId: campaign.id,
        channel,
        stepNumber: step.stepNumber,
        content,
        status: "DRAFT",
      },
    })

    await logActivity({
      workspaceId: campaign.workspaceId,
      leadId: enrollment.leadId,
      campaignId: campaign.id,
      type: "QUEUED",
      channel,
      stepNumber: step.stepNumber,
    })

    // Park the enrollment until the operator sends it.
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { nextSendAt: null },
    })

    return { outcome: "queued" }
  }

  if (!enrollment.lead.email) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "STOPPED", nextSendAt: null },
    })
    return { outcome: "skipped", reason: "no_email" }
  }

  const fromEmail = campaign.fromEmail ?? process.env.RESEND_FROM_EMAIL
  const fromName = campaign.fromName ?? "Outreach Team"

  if (!fromEmail) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "STOPPED", nextSendAt: null },
    })
    return { outcome: "skipped", reason: "no_from_email_configured" }
  }

  const subject = renderTemplate(step.subject ?? campaign.name, enrollment.lead)
  const body = renderTemplate(step.template, enrollment.lead)

  const result = await sendOutreachEmail({
    toEmail: enrollment.lead.email,
    toName: enrollment.lead.firstName,
    fromName,
    fromEmail,
    subject,
    messageContent: body,
    leadId: enrollment.leadId,
    workspaceId: campaign.workspaceId,
  })

  await advance(result.success ? (nextStep ? "ACTIVE" : "COMPLETED") : "STOPPED")

  if (result.success && enrollment.lead.status === "NEW") {
    await prisma.lead.update({ where: { id: enrollment.leadId }, data: { status: "CONTACTED" } })
  }

  return result.success ? { outcome: "sent" } : { outcome: "skipped", reason: "send_failed" }
}
