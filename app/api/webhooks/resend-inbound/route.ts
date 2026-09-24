import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { prisma } from "@/lib/prisma"
import { classifyReply } from "@/lib/ai/personalization"
import { getResendClient } from "@/lib/email/client"

const LEAD_STATUS_BY_INTENT: Record<string, string> = {
  INTERESTED: "INTERESTED",
  NOT_INTERESTED: "NOT_INTERESTED",
  QUESTION: "REPLIED",
  OUT_OF_OFFICE: "CONTACTED",
  OTHER: "REPLIED",
}

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

  if (event.type !== "email.received") {
    return NextResponse.json({ success: true })
  }

  // `from` can arrive as "Sara Khan <sara@acme.com>". Match only a lead we
  // actually emailed, most recent first, so the same address in another
  // workspace (or an old, never-contacted import) is not touched.
  const fromAddress = (event.data.from.match(/<([^>]+)>/)?.[1] ?? event.data.from).trim()
  const lead = await prisma.lead.findFirst({
    where: {
      email: { equals: fromAddress, mode: "insensitive" },
      messages: { some: { type: "EMAIL", direction: "OUTBOUND", status: "SENT" } },
    },
    orderBy: { updatedAt: "desc" },
    include: { campaign: true },
  })

  // Reply from an address we're not tracking as a lead — nothing to act on.
  if (!lead || !lead.campaign) {
    return NextResponse.json({ success: true })
  }

  const client = await getResendClient(lead.campaign.workspaceId)
  const { data: fullEmail } = await client.emails.receiving.get(event.data.email_id)
  const bodyText = fullEmail?.text ?? fullEmail?.html ?? "(no content)"

  await prisma.message.create({
    data: {
      leadId: lead.id,
      content: bodyText,
      type: "EMAIL",
      direction: "INBOUND",
      status: "REPLIED",
    },
  })

  const classification = await classifyReply(lead.campaign.workspaceId, bodyText)
  const newStatus = LEAD_STATUS_BY_INTENT[classification.intent] ?? "REPLIED"

  await prisma.lead.update({ where: { id: lead.id }, data: { status: newStatus as never } })

  // A real reply that shows interest or asks something real needs a human — pause automation.
  // An uncertain "OTHER" classification also gets flagged rather than guessed at.
  const needsReview =
    classification.intent === "INTERESTED" ||
    classification.intent === "QUESTION" ||
    (classification.intent === "OTHER" && classification.confidence < 0.6)

  if (needsReview) {
    await prisma.sequenceEnrollment.updateMany({
      where: { leadId: lead.id, status: "ACTIVE" },
      data: { status: "NEEDS_REVIEW", nextSendAt: null },
    })
  } else if (classification.intent === "NOT_INTERESTED") {
    await prisma.sequenceEnrollment.updateMany({
      where: { leadId: lead.id, status: { in: ["ACTIVE", "NEEDS_REVIEW"] } },
      data: { status: "STOPPED", nextSendAt: null },
    })
  }

  return NextResponse.json({ success: true, data: classification })
}
