import { subDays } from "date-fns"
import { prisma } from "@/lib/prisma"

export interface FunnelStats {
  leads: number
  queued: number
  sent: number
  connected: number
  replied: number
  interested: number
  meetings: number
  connectionRate: number
  replyRate: number
  interestRate: number
}

function rate(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return Math.round((numerator / denominator) * 1000) / 10
}

async function countActivities(where: Record<string, unknown>) {
  const grouped = await prisma.activity.groupBy({
    by: ["type"],
    where,
    _count: { _all: true },
  })
  return new Map(grouped.map((g) => [g.type, g._count._all]))
}

export async function getFunnel(
  workspaceId: string,
  campaignId?: string
): Promise<FunnelStats> {
  const scope = campaignId ? { workspaceId, campaignId } : { workspaceId }

  const [counts, leads, queued] = await Promise.all([
    countActivities(scope),
    prisma.lead.count({
      where: campaignId
        ? { campaignId }
        : { campaign: { workspaceId } },
    }),
    prisma.sendQueueItem.count({
      where: { ...(campaignId ? { campaignId } : {}), workspaceId, status: { in: ["DRAFT", "READY"] } },
    }),
  ])

  const sent = counts.get("SENT") ?? 0
  const connected = counts.get("CONNECTION_ACCEPTED") ?? 0
  const replied = counts.get("REPLIED") ?? 0
  const interested = counts.get("INTERESTED") ?? 0
  const meetings = counts.get("MEETING_BOOKED") ?? 0

  return {
    leads,
    queued,
    sent,
    connected,
    replied,
    interested,
    meetings,
    connectionRate: rate(connected, sent),
    replyRate: rate(replied, sent),
    interestRate: rate(interested, replied),
  }
}

export interface DailyPoint {
  date: string
  sent: number
  connected: number
  replied: number
}

export async function getDailySeries(
  workspaceId: string,
  days = 30,
  campaignId?: string
): Promise<DailyPoint[]> {
  const since = subDays(new Date(), days - 1)
  since.setHours(0, 0, 0, 0)

  const activities = await prisma.activity.findMany({
    where: {
      workspaceId,
      ...(campaignId ? { campaignId } : {}),
      type: { in: ["SENT", "CONNECTION_ACCEPTED", "REPLIED"] },
      createdAt: { gte: since },
    },
    select: { type: true, createdAt: true },
  })

  const buckets = new Map<string, DailyPoint>()
  for (let i = 0; i < days; i++) {
    const key = subDays(new Date(), days - 1 - i).toISOString().slice(0, 10)
    buckets.set(key, { date: key, sent: 0, connected: 0, replied: 0 })
  }

  for (const activity of activities) {
    const key = activity.createdAt.toISOString().slice(0, 10)
    const bucket = buckets.get(key)
    if (!bucket) continue
    if (activity.type === "SENT") bucket.sent++
    else if (activity.type === "CONNECTION_ACCEPTED") bucket.connected++
    else if (activity.type === "REPLIED") bucket.replied++
  }

  return [...buckets.values()]
}

export async function getStepBreakdown(workspaceId: string, campaignId?: string) {
  const grouped = await prisma.sendQueueItem.groupBy({
    by: ["channel", "stepNumber", "status"],
    where: { workspaceId, ...(campaignId ? { campaignId } : {}) },
    _count: { _all: true },
  })

  const map = new Map<string, { channel: string; stepNumber: number; draft: number; ready: number; sent: number; skipped: number }>()

  for (const row of grouped) {
    const key = `${row.channel}#${row.stepNumber}`
    const entry =
      map.get(key) ??
      { channel: row.channel, stepNumber: row.stepNumber, draft: 0, ready: 0, sent: 0, skipped: 0 }

    if (row.status === "DRAFT") entry.draft += row._count._all
    if (row.status === "READY") entry.ready += row._count._all
    if (row.status === "SENT") entry.sent += row._count._all
    if (row.status === "SKIPPED") entry.skipped += row._count._all

    map.set(key, entry)
  }

  return [...map.values()].sort(
    (a, b) => a.channel.localeCompare(b.channel) || a.stepNumber - b.stepNumber
  )
}

export async function getLeadStatusBreakdown(workspaceId: string, campaignId?: string) {
  const grouped = await prisma.lead.groupBy({
    by: ["status"],
    where: campaignId ? { campaignId } : { campaign: { workspaceId } },
    _count: { _all: true },
  })

  return grouped.map((g) => ({ status: g.status, count: g._count._all }))
}
