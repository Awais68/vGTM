import { prisma } from "@/lib/prisma"
import type { Prisma, QueueChannel } from "@prisma/client"
import { generateQueue } from "@/lib/queue/service"
import { getAccountCapacity, syncHeyReachAccounts } from "@/lib/linkedin/accounts"
import { runTrigger } from "./engine"

export interface AutopilotResult {
  workspaceId: string
  ran: boolean
  reason?: string
  topUp: { campaignId: string; campaignName: string; channel: QueueChannel; created: number }[]
  ruleRuns: { trigger: string; rulesRun: number; affected: number }[]
  senderSync?: { created: number; updated: number }
}

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * The one job autopilot actually does: keep every active campaign's queue
 * topped up to the target, spread across senders that still have headroom and
 * are inside their working hours, then run the schedule-driven rules.
 *
 * It never sends a LinkedIn message. The only thing it automates is the work
 * before the send — drafting, sequencing, assignment and enrolment.
 */
export async function runAutopilot(workspaceId: string): Promise<AutopilotResult> {
  const result: AutopilotResult = { workspaceId, ran: false, topUp: [], ruleRuns: [] }

  const settings = await prisma.workspaceSetting.findUnique({ where: { workspaceId } })
  if (!settings?.autopilotEnabled) {
    result.reason = "Autopilot is off for this workspace"
    return result
  }

  result.ran = true
  const startedAt = Date.now()

  // Keep the mirrored sender list fresh, but not on every tick.
  if (settings.heyreachApiKey) {
    const stale = await prisma.linkedInAccount.findFirst({
      where: {
        workspaceId,
        provider: "HEYREACH",
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(Date.now() - SYNC_INTERVAL_MS) } }],
      },
      select: { id: true },
    })
    const none = (await prisma.linkedInAccount.count({ where: { workspaceId, provider: "HEYREACH" } })) === 0

    if (stale || none) {
      try {
        const sync = await syncHeyReachAccounts(workspaceId)
        result.senderSync = { created: sync.created, updated: sync.updated }
      } catch {
        // A broken HeyReach key must not stop the rest of autopilot.
      }
    }
  }

  // 1. Schedule-driven rules.
  for (const trigger of ["SCHEDULE", "NO_REPLY_AFTER_DAYS", "QUEUE_LOW"] as const) {
    const run = await runTrigger({ workspaceId, trigger })
    if (run.rulesRun > 0) {
      result.ruleRuns.push({ trigger, rulesRun: run.rulesRun, affected: run.affected })
    }
  }

  // 2. Built-in queue top-up for active campaigns.
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId, status: "ACTIVE", mode: { in: ["MANUAL_QUEUE", "HYBRID"] } },
    select: { id: true, name: true },
  })

  const channels: QueueChannel[] = ["LINKEDIN_CONNECTION", "LINKEDIN_MESSAGE"]

  for (const campaign of campaigns) {
    for (const channel of channels) {
      const capacity = await getAccountCapacity(workspaceId, channel)
      const usable = capacity
        .filter((c) => c.withinHours)
        .reduce((sum, c) => sum + Math.max(0, c.remaining - c.pending), 0)

      if (usable === 0) continue

      const pending = await prisma.sendQueueItem.count({
        where: { workspaceId, campaignId: campaign.id, channel, status: { in: ["DRAFT", "READY"] } },
      })

      const room = Math.min(usable, settings.autopilotQueueTarget - pending)
      if (room <= 0) continue

      const generated = await generateQueue({
        workspaceId,
        campaignId: campaign.id,
        channel,
        limit: room,
        assignSender: true,
      })

      if (generated.created > 0) {
        result.topUp.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          channel,
          created: generated.created,
        })
      }
    }
  }

  const affected = result.topUp.reduce((sum, t) => sum + t.created, 0)

  await prisma.automationRun.create({
    data: {
      workspaceId,
      trigger: "QUEUE_LOW",
      status: "SUCCESS",
      affected,
      message: affected > 0 ? `Autopilot drafted ${affected} messages` : "Autopilot: nothing to do",
      detail: result as unknown as Prisma.InputJsonValue,
      durationMs: Date.now() - startedAt,
    },
  })

  return result
}

/** Cron entry point: every workspace that has switched autopilot on. */
export async function runAutopilotForAllWorkspaces(): Promise<AutopilotResult[]> {
  const settings = await prisma.workspaceSetting.findMany({
    where: { autopilotEnabled: true },
    select: { workspaceId: true },
  })

  const results: AutopilotResult[] = []
  for (const { workspaceId } of settings) {
    try {
      results.push(await runAutopilot(workspaceId))
    } catch (error) {
      results.push({
        workspaceId,
        ran: false,
        reason: error instanceof Error ? error.message : "autopilot failed",
        topUp: [],
        ruleRuns: [],
      })
    }
  }
  return results
}
