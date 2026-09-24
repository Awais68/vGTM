import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET

  if (!webhookSecret) {
    return NextResponse.json({ success: false, error: "Webhook not configured" }, { status: 500 })
  }

  const payload = await request.text()
  const id = request.headers.get("svix-id")
  const timestamp = request.headers.get("svix-timestamp")
  const signature = request.headers.get("svix-signature")

  if (!id || !timestamp || !signature) {
    return NextResponse.json({ success: false, error: "Missing signature headers" }, { status: 400 })
  }

  let event: ReturnType<Resend["webhooks"]["verify"]>
  try {
    const resend = new Resend(process.env.RESEND_API_KEY ?? "verify-only")
    event = resend.webhooks.verify({
      payload,
      webhookSecret,
      headers: { id, timestamp, signature },
    })
  } catch {
    return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 })
  }

  if (event.type === "email.bounced" || event.type === "email.complained") {
    const message = await prisma.message.findFirst({
      where: { resendMessageId: event.data.email_id },
    })

    if (message) {
      await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } })
      await prisma.lead.update({
        where: { id: message.leadId },
        data: { unsubscribed: true, status: "NOT_INTERESTED" },
      })
      await prisma.sequenceEnrollment.updateMany({
        where: { leadId: message.leadId, status: { in: ["ACTIVE", "NEEDS_REVIEW"] } },
        data: { status: "STOPPED", nextSendAt: null },
      })
    }
  }

  return NextResponse.json({ success: true })
}
