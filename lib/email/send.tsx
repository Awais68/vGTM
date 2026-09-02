import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"
import { getResendClient } from "./client"

export interface SendEmailParams {
  toEmail: string
  toName: string
  fromName: string
  fromEmail: string
  subject: string
  messageContent: string
  leadId: string
  workspaceId: string
}

export interface SendResult {
  success: boolean
  messageId?: string
  error?: string
}

const UNSUBSCRIBE_SECRET =
  process.env.UNSUBSCRIBE_SECRET ?? "default-unsubscribe-secret-change-me"

export function generateUnsubscribeToken(leadId: string): string {
  return crypto
    .createHash("sha256")
    .update(leadId + UNSUBSCRIBE_SECRET)
    .digest("hex")
}

export function verifyUnsubscribeToken(
  leadId: string,
  token: string
): boolean {
  const expected = generateUnsubscribeToken(leadId)
  const expectedBuf = Buffer.from(expected)
  const tokenBuf = Buffer.from(token)

  if (expectedBuf.byteLength !== tokenBuf.byteLength) return false

  return crypto.timingSafeEqual(expectedBuf, tokenBuf)
}

export async function sendOutreachEmail(
  params: SendEmailParams
): Promise<SendResult> {
  const {
    toEmail,
    toName,
    fromName,
    fromEmail,
    subject,
    messageContent,
    leadId,
    workspaceId,
  } = params

  try {
    const resend = await getResendClient(workspaceId)

    const { default: OutreachEmail } = await import(
      "@/emails/OutreachEmail"
    )

    const unsubscribeToken = generateUnsubscribeToken(leadId)

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject,
      react: (
        <OutreachEmail
          firstName={toName}
          senderName={fromName}
          senderTitle=""
          messageContent={messageContent}
          unsubscribeToken={unsubscribeToken}
        />
      ),
    })

    if (error) {
      await prisma.message.create({
        data: {
          leadId,
          content: messageContent,
          type: "EMAIL",
          status: "FAILED",
        },
      })

      return { success: false, error: error.message }
    }

    await prisma.message.create({
      data: {
        leadId,
        content: messageContent,
        type: "EMAIL",
        status: "SENT",
        sentAt: new Date(),
      },
    })

    return { success: true, messageId: data?.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email"

    await prisma.message.create({
      data: {
        leadId,
        content: messageContent,
        type: "EMAIL",
        status: "FAILED",
      },
    })

    return { success: false, error: message }
  }
}

export async function trackEmailOpen(token: string): Promise<void> {
  const message = await prisma.message.findFirst({
    where: { status: "SENT" },
    orderBy: { createdAt: "desc" },
  })

  if (!message) return

  const lead = await prisma.lead.findUnique({
    where: { id: message.leadId },
  })

  if (!lead) return

  if (!verifyUnsubscribeToken(lead.id, token)) return

  await prisma.message.update({
    where: { id: message.id },
    data: { status: "DELIVERED" },
  })
}
