import { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyUnsubscribeToken } from "@/lib/email/send"

/**
 * Unsubscribe is a two-step flow on purpose. Mail security scanners (Outlook
 * Safe Links, corporate proxies) fetch every link in an email with GET, so a
 * GET that unsubscribes would silently opt out most corporate leads the moment
 * the email arrived. GET only shows a confirm button; POST does the work.
 * POST also serves RFC 8058 one-click unsubscribe from the List-Unsubscribe
 * header, which mail clients send without a browser.
 */

function readParams(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  return { token: searchParams.get("token"), leadId: searchParams.get("leadId") }
}

function html(body: string, status: number) {
  return new Response(page(body), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  })
}

async function validLead(leadId: string | null, token: string | null) {
  if (!token || !leadId || !verifyUnsubscribeToken(leadId, token)) return null
  return prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, unsubscribed: true } })
}

export async function GET(request: NextRequest) {
  const { token, leadId } = readParams(request)
  const lead = await validLead(leadId, token)

  if (!lead) return html(message("Invalid unsubscribe link.", false), 400)

  if (lead.unsubscribed) {
    return html(message("You are already unsubscribed. You will not receive further emails from us.", true), 200)
  }

  return html(confirmForm(request.url), 200)
}

export async function POST(request: NextRequest) {
  const { token, leadId } = readParams(request)
  const lead = await validLead(leadId, token)

  if (!lead) return html(message("Invalid unsubscribe link.", false), 400)

  await unsubscribeLead(lead.id)

  // One-click requests come from the mail client, not a person; a plain 200 is enough.
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.text().catch(() => "")
    if (body.includes("List-Unsubscribe=One-Click")) {
      return new Response(null, { status: 200 })
    }
  }

  return html(message("You have been unsubscribed. You will no longer receive emails from us.", true), 200)
}

async function unsubscribeLead(leadId: string) {
  await prisma.lead.update({
    where: { id: leadId },
    data: { unsubscribed: true, status: "NOT_INTERESTED" },
  })

  await prisma.sequenceEnrollment.updateMany({
    where: { leadId, status: { in: ["ACTIVE", "NEEDS_REVIEW"] } },
    data: { status: "STOPPED", nextSendAt: null },
  })

  await prisma.sendQueueItem.updateMany({
    where: { leadId, status: { in: ["DRAFT", "READY"] } },
    data: { status: "SKIPPED", skipReason: "Lead unsubscribed" },
  })
}

function message(text: string, success: boolean): string {
  return `
    <div class="icon">${success ? "&#10003;" : "&#10007;"}</div>
    <p class="message ${success ? "success" : "error"}">${text}</p>`
}

function confirmForm(actionUrl: string): string {
  // The URL only ever contains our own leadId + hex token, but escape anyway.
  const safeAction = actionUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;")
  return `
    <p class="message">Do you want to stop receiving emails from us?</p>
    <form method="post" action="${safeAction}">
      <button type="submit" class="button">Yes, unsubscribe me</button>
    </form>
    <p class="hint">If you opened this by mistake, just close the page.</p>`
}

function page(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex">
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
    .hint { font-size: 13px; color: #888; margin-top: 16px; }
    .success { color: #16a34a; }
    .error { color: #dc2626; }
    .button {
      margin-top: 8px;
      padding: 10px 20px;
      font-size: 15px;
      color: white;
      background: #dc2626;
      border: 0;
      border-radius: 8px;
      cursor: pointer;
    }
    .button:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="card">${body}
  </div>
</body>
</html>`
}
