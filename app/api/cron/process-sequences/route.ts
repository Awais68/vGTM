import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { processDueStep } from "@/lib/sequences/engine"

const BATCH_SIZE = 50
/** How long a claimed enrollment is hidden from overlapping cron runs. */
const CLAIM_LEASE_MS = 30 * 60 * 1000

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

  const results = { processed: 0, sent: 0, queued: 0, completed: 0, retried: 0, skipped: 0, errored: 0 }
  const errors: { enrollmentId: string; error: string }[] = []

  // One bad enrollment (AI outage, malformed lead, provider hiccup) must not
  // take the rest of the batch down with it.
  for (const enrollment of due) {
    // Claim the row before touching it. If a previous run is still going (a
    // slow AI provider can push a batch past 15 min), whoever loses the claim
    // skips it, so the same step is never sent twice. processDueStep always
    // rewrites nextSendAt, so the lease only matters if the run dies midway.
    const now = new Date()
    const claim = await prisma.sequenceEnrollment.updateMany({
      where: { id: enrollment.id, status: "ACTIVE", nextSendAt: { lte: now } },
      data: { nextSendAt: new Date(now.getTime() + CLAIM_LEASE_MS) },
    })
    if (claim.count === 0) {
      results.skipped++
      continue
    }

    results.processed++
    try {
      const result = await processDueStep(enrollment.id)
      if (result.outcome === "sent") results.sent++
      else if (result.outcome === "queued") results.queued++
      else if (result.outcome === "completed") results.completed++
      else if (result.outcome === "retry") results.retried++
      else results.skipped++
    } catch (error) {
      results.errored++
      const message = error instanceof Error ? error.message : "processing failed"
      errors.push({ enrollmentId: enrollment.id, error: message })
      console.error(`[cron] enrollment ${enrollment.id} failed:`, message)

      // Push it out an hour so a hard-failing row cannot hog every batch.
      await prisma.sequenceEnrollment
        .update({
          where: { id: enrollment.id },
          data: {
            failureCount: { increment: 1 },
            lastError: message,
            nextSendAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        })
        .catch(() => {})
    }
  }

  return NextResponse.json({ success: true, data: { ...results, errors: errors.slice(0, 10) } })
}
