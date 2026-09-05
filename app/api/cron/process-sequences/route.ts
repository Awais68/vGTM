import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { processDueStep } from "@/lib/sequences/engine"

const BATCH_SIZE = 50

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")

  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const due = await prisma.sequenceEnrollment.findMany({
    where: { status: "ACTIVE", nextSendAt: { lte: new Date() } },
    take: BATCH_SIZE,
    select: { id: true },
  })

  const results = { processed: 0, sent: 0, queued: 0, completed: 0, skipped: 0 }

  for (const enrollment of due) {
    const result = await processDueStep(enrollment.id)
    results.processed++
    if (result.outcome === "sent") results.sent++
    else if (result.outcome === "queued") results.queued++
    else if (result.outcome === "completed") results.completed++
    else results.skipped++
  }

  return NextResponse.json({ success: true, data: results })
}
