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
  | { outcome: "retry"; reason: string }
  | { outcome: "skipped"; reason: string }

/** In-request attempts before the enrollment is parked for the next cron run. */
const SEND_ATTEMPTS = 3
/** Cron runs a failing enrollment can burn before it is stopped for good. */
const MAX_FAILURES = 5
const RETRY_BACKOFF_MS = [1000, 4000]

/**
 * A permanent rejection means retrying changes nothing: an unverified domain,
 * a malformed address, a revoked key. Everything else — rate limits, 5xx,
 * socket resets — is worth another attempt.
 */
function isPermanentSendError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes("not verified") ||
    m.includes("domain is not") ||
    m.includes("invalid `to`") ||
    m.includes("invalid to") ||
    m.includes("invalid `from`") ||
    m.includes("invalid from") ||
    m.includes("validation_error") ||
    m.includes("api key is invalid") ||
    m.includes("unauthorized") ||
    m.includes("forbidden")
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Sends with a short backoff. Returns `permanent` so the caller can tell a
 * dead-end apart from "the provider was busy for a second".
 */
async function sendWithRetry(
  params: Parameters<typeof sendOutreachEmail>[0]
): Promise<{ success: boolean; error?: string; permanent: boolean }> {
  let lastError = "send failed"

  for (let attempt = 0; attempt < SEND_ATTEMPTS; attempt++) {
    let result: Awaited<ReturnType<typeof sendOutreachEmail>>
    try {
      result = await sendOutreachEmail(params)
    } catch (error) {
      result = { success: false, error: error instanceof Error ? error.message : "send failed" }
    }

    if (result.success) return { success: true, permanent: false }

    lastError = result.error ?? "send failed"
    if (isPermanentSendError(lastError)) return { success: false, error: lastError, permanent: true }

    if (attempt < SEND_ATTEMPTS - 1) await sleep(RETRY_BACKOFF_MS[attempt] ?? 4000)
  }

  return { success: false, error: lastError, permanent: false }
}

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
        failureCount: 0,
        lastError: null,
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

  const result = await sendWithRetry({
    toEmail: enrollment.lead.email,
    toName: enrollment.lead.firstName,
    fromName,
    fromEmail,
    subject,
    messageContent: body,
    leadId: enrollment.leadId,
    workspaceId: campaign.workspaceId,
  })

  if (result.success) {
    await advance(nextStep ? "ACTIVE" : "COMPLETED")
    if (enrollment.lead.status === "NEW") {
      await prisma.lead.update({ where: { id: enrollment.leadId }, data: { status: "CONTACTED" } })
    }
    return { outcome: "sent" }
  }

  // A transient failure must not burn the step or kill the sequence — park the
  // enrollment on the same step and let the next cron run pick it up again.
  const failures = enrollment.failureCount + 1
  const giveUp = result.permanent || failures >= MAX_FAILURES

  await prisma.sequenceEnrollment.update({
    where: { id: enrollmentId },
    data: {
      failureCount: failures,
      lastError: result.error ?? "send failed",
      ...(giveUp
        ? { status: "STOPPED" as const, nextSendAt: null }
        : { nextSendAt: new Date(Date.now() + failures * 30 * 60 * 1000) }),
    },
  })

  return giveUp
    ? { outcome: "skipped", reason: result.permanent ? "send_failed_permanent" : "send_failed_max_retries" }
    : { outcome: "retry", reason: result.error ?? "send_failed" }
}
