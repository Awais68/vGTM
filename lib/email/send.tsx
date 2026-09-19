import { getAppUrl } from "@/lib/app-url"
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

function unsubscribeSecret(): string {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (secret) return secret
  // A guessable secret lets anyone forge tokens and unsubscribe every lead,
  // so outside local development there is no fallback.
  if (process.env.NODE_ENV === "production") {
    throw new Error("UNSUBSCRIBE_SECRET is not set — required to send email in production")
  }
  return "dev-only-unsubscribe-secret"
}

export function generateUnsubscribeToken(leadId: string): string {
  return crypto.createHmac("sha256", unsubscribeSecret()).update(leadId).digest("hex")
}

export function buildUnsubscribeUrl(leadId: string): string {
  const base = getAppUrl()
  const params = new URLSearchParams({ leadId, token: generateUnsubscribeToken(leadId) })
  return `${base}/api/email/unsubscribe?${params.toString()}`
}

export function verifyUnsubscribeToken(
  leadId: string,
  token: string
): boolean {
  let expected: string
  try {
    expected = generateUnsubscribeToken(leadId)
  } catch {
    return false
  }
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
    const unsubscribeUrl = buildUnsubscribeUrl(leadId)

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [toEmail],
      subject,
      // RFC 8058 one-click unsubscribe. Gmail/Yahoo require this for bulk
      // senders; the POST handler on the route honours it.
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      react: (
        <OutreachEmail
          firstName={toName}
          senderName={fromName}
          senderTitle=""
          messageContent={messageContent}
          leadId={leadId}
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
        resendMessageId: data?.id,
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
