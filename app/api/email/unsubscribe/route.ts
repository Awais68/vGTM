import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyUnsubscribeToken } from "@/lib/email/send"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  const leadId = searchParams.get("leadId")

  if (!token || !leadId) {
    return new Response(
      getUnsubscribePage("Invalid unsubscribe link.", false),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    )
  }

  if (!verifyUnsubscribeToken(leadId, token)) {
    return new Response(
      getUnsubscribePage("Invalid unsubscribe link.", false),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    )
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } })

  if (!lead) {
    return new Response(
      getUnsubscribePage("Invalid unsubscribe link.", false),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    )
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { unsubscribed: true, status: "NOT_INTERESTED" },
  })

  await prisma.sequenceEnrollment.updateMany({
    where: { leadId, status: { in: ["ACTIVE", "NEEDS_REVIEW"] } },
    data: { status: "STOPPED", nextSendAt: null },
  })

  return new Response(
    getUnsubscribePage(
      "You have been unsubscribed. You will no longer receive emails from us.",
      true
    ),
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }
  )
}

function getUnsubscribePage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f6f6f6;
    }
    .card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      text-align: center;
      max-width: 420px;
    }
    .icon { font-size: 48px; margin-bottom: 16px; }
    .message { font-size: 16px; color: #333; line-height: 1.5; }
    .success { color: #16a34a; }
    .error { color: #dc2626; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "&#10003;" : "&#10007;"}</div>
    <p class="message ${success ? "success" : "error"}">${message}</p>
  </div>
</body>
</html>`
}
