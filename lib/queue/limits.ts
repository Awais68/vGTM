import { prisma } from "@/lib/prisma"
import { QueueChannel } from "@prisma/client"

/**
 * Conservative defaults. These are a brake on the operator, not a way around
 * anything: the app can only ever count what a human tells it they sent.
 */
export const DEFAULT_LIMITS = {
  dailyConnectionLimit: 20,
  dailyMessageLimit: 40,
}

export interface DailyUsage {
  channel: QueueChannel
  sentToday: number
  limit: number
  remaining: number
  overLimit: boolean
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function getDailyUsage(workspaceId: string): Promise<DailyUsage[]> {
  const setting = await prisma.workspaceSetting.findUnique({ where: { workspaceId } })

  const limits: Record<QueueChannel, number> = {
    LINKEDIN_CONNECTION: setting?.dailyConnectionLimit ?? DEFAULT_LIMITS.dailyConnectionLimit,
    LINKEDIN_MESSAGE: setting?.dailyMessageLimit ?? DEFAULT_LIMITS.dailyMessageLimit,
    EMAIL: Number.MAX_SAFE_INTEGER,
  }

  const grouped = await prisma.sendQueueItem.groupBy({
    by: ["channel"],
    where: { workspaceId, status: "SENT", sentAt: { gte: startOfToday() } },
    _count: { _all: true },
  })

  const counts = new Map(grouped.map((g) => [g.channel, g._count._all]))

  return (Object.keys(limits) as QueueChannel[])
    .filter((channel) => channel !== "EMAIL")
    .map((channel) => {
      const sentToday = counts.get(channel) ?? 0
      const limit = limits[channel]
      return {
        channel,
        sentToday,
        limit,
        remaining: Math.max(0, limit - sentToday),
        overLimit: sentToday >= limit,
      }
    })
}

export async function checkDailyLimit(
  workspaceId: string,
  channel: QueueChannel
): Promise<{ allowed: boolean; usage: DailyUsage | null }> {
  if (channel === "EMAIL") return { allowed: true, usage: null }

  const usage = await getDailyUsage(workspaceId)
  const entry = usage.find((u) => u.channel === channel) ?? null

  return { allowed: !entry?.overLimit, usage: entry }
}
