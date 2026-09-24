import { prisma } from "@/lib/prisma"
import type { LinkedInAccount, QueueChannel, Prisma } from "@prisma/client"
import { getHeyReachClient } from "@/lib/heyreach/get-client"

export interface WorkingHourSlot {
  day: number // 0 = Sunday
  enabled: boolean
  startHour: number
  endHour: number
}

export const DEFAULT_WORKING_HOURS: WorkingHourSlot[] = [
  { day: 0, enabled: false, startHour: 9, endHour: 17 },
  { day: 1, enabled: true, startHour: 9, endHour: 17 },
  { day: 2, enabled: true, startHour: 9, endHour: 17 },
  { day: 3, enabled: true, startHour: 9, endHour: 17 },
  { day: 4, enabled: true, startHour: 9, endHour: 17 },
  { day: 5, enabled: true, startHour: 9, endHour: 17 },
  { day: 6, enabled: false, startHour: 9, endHour: 17 },
]

export function parseWorkingHours(value: Prisma.JsonValue | null): WorkingHourSlot[] {
  if (!Array.isArray(value)) return DEFAULT_WORKING_HOURS
  const slots = value as unknown as WorkingHourSlot[]
  if (slots.length !== 7) return DEFAULT_WORKING_HOURS
  return slots
}

/**
 * Warm-up ramp. A brand-new sender that suddenly fires 40 connection requests
 * is the classic way to get restricted, so the effective cap starts at 30% of
 * the configured limit and reaches 100% over `warmupDays`.
 */
export function warmupFactor(account: LinkedInAccount, now = new Date()): number {
  if (!account.warmupEnabled) return 1
  const start = account.warmupStartAt ?? account.createdAt
  const days = (now.getTime() - start.getTime()) / 86_400_000
  if (days >= account.warmupDays) return 1
  return Math.min(1, 0.3 + (0.7 * Math.max(0, days)) / Math.max(1, account.warmupDays))
}

export function effectiveLimit(
  account: LinkedInAccount,
  channel: QueueChannel,
  now = new Date()
): number {
  if (channel === "EMAIL") return Number.MAX_SAFE_INTEGER
  const base =
    channel === "LINKEDIN_CONNECTION" ? account.dailyConnectionLimit : account.dailyMessageLimit
  return Math.max(1, Math.floor(base * warmupFactor(account, now)))
}

export function isWithinWorkingHours(account: LinkedInAccount, now = new Date()): boolean {
  const slots = parseWorkingHours(account.workingHours)
  // Interpreting "now" in the account's own timezone matters when an operator
  // runs several senders across regions.
  const local = new Date(now.toLocaleString("en-US", { timeZone: account.timezone || "UTC" }))
  const slot = slots.find((s) => s.day === local.getDay())
  if (!slot || !slot.enabled) return false
  const hour = local.getHours()
  return hour >= slot.startHour && hour < slot.endHour
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export interface AccountCapacity {
  account: LinkedInAccount
  channel: QueueChannel
  sentToday: number
  limit: number
  remaining: number
  withinHours: boolean
  /** Drafts already waiting on this account — capacity we've committed. */
  pending: number
}

/** Per-account, per-channel usage for today. */
export async function getAccountCapacity(
  workspaceId: string,
  channel: QueueChannel,
  now = new Date()
): Promise<AccountCapacity[]> {
  const accounts = await prisma.linkedInAccount.findMany({
    where: { workspaceId, status: "ACTIVE" },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  })

  if (accounts.length === 0) return []

  const [sent, pending] = await Promise.all([
    prisma.sendQueueItem.groupBy({
      by: ["linkedInAccountId"],
      where: { workspaceId, channel, status: "SENT", sentAt: { gte: startOfToday() } },
      _count: { _all: true },
    }),
    prisma.sendQueueItem.groupBy({
      by: ["linkedInAccountId"],
      where: { workspaceId, channel, status: { in: ["DRAFT", "READY"] } },
      _count: { _all: true },
    }),
  ])

  const sentBy = new Map(sent.map((s) => [s.linkedInAccountId, s._count._all]))
  const pendingBy = new Map(pending.map((p) => [p.linkedInAccountId, p._count._all]))

  return accounts.map((account) => {
    const sentToday = sentBy.get(account.id) ?? 0
    const limit = effectiveLimit(account, channel, now)
    return {
      account,
      channel,
      sentToday,
      limit,
      remaining: Math.max(0, limit - sentToday),
      withinHours: isWithinWorkingHours(account, now),
      pending: pendingBy.get(account.id) ?? 0,
    }
  })
}

/**
 * Round-robin with headroom: pick the eligible sender that has the most
 * unused capacity left today, counting drafts we've already assigned to it.
 * Returns null when every sender is out of room — the caller should stop
 * generating rather than pile up drafts nobody can send.
 */
export async function pickSenderAccount(options: {
  workspaceId: string
  channel: QueueChannel
  campaignId?: string | null
  /** Pin every draft to this sender instead of rotating across all of them. */
  accountId?: string | null
  /** Ignore the working-hours window (manual "generate now" from the UI). */
  ignoreSchedule?: boolean
  now?: Date
}): Promise<{ accountId: string; capacity: AccountCapacity } | null> {
  const {
    workspaceId,
    channel,
    campaignId,
    accountId,
    ignoreSchedule = false,
    now = new Date(),
  } = options

  let capacities = await getAccountCapacity(workspaceId, channel, now)
  if (capacities.length === 0) return null

  // An explicitly chosen sender still has to have headroom — it just never
  // silently falls back to a different profile.
  if (accountId) {
    capacities = capacities.filter((c) => c.account.id === accountId)
  } else if (campaignId) {
    const assigned = await prisma.campaignSender.findMany({
      where: { campaignId },
      select: { accountId: true },
    })
    // No explicit sender list means "any active sender".
    if (assigned.length > 0) {
      const allowed = new Set(assigned.map((a) => a.accountId))
      capacities = capacities.filter((c) => allowed.has(c.account.id))
    }
  }

  const eligible = capacities
    .filter((c) => c.remaining - c.pending > 0)
    .filter((c) => ignoreSchedule || c.withinHours)

  if (eligible.length === 0) return null

  eligible.sort((a, b) => b.remaining - b.pending - (a.remaining - a.pending))
  const chosen = eligible[0]
  return { accountId: chosen.account.id, capacity: chosen }
}

export interface SyncResult {
  created: number
  updated: number
  total: number
}

/**
 * Mirrors the HeyReach sender list into our LinkedInAccount table.
 * Local limits and schedules are never overwritten — only identity and
 * connection status come from HeyReach.
 */
export async function syncHeyReachAccounts(workspaceId: string): Promise<SyncResult> {
  const client = await getHeyReachClient(workspaceId)
  const remote = await client.getLinkedInAccounts()

  let created = 0
  let updated = 0

  for (const account of remote) {
    const name =
      account.fullName?.trim() ||
      [account.firstName, account.lastName].filter(Boolean).join(" ").trim() ||
      account.emailAddress ||
      `HeyReach sender ${account.id}`

    const status = account.isActive === false ? "DISCONNECTED" : "ACTIVE"

    const existing = await prisma.linkedInAccount.findFirst({
      where: { workspaceId, heyreachAccountId: account.id },
      select: { id: true },
    })

    const identity = {
      name,
      email: account.emailAddress ?? null,
      profileUrl: account.profileUrl ?? null,
      avatarUrl: account.profileImage ?? null,
      subscription: mapPlan(account.accountType),
      status: status as "ACTIVE" | "DISCONNECTED",
      lastSyncedAt: new Date(),
    }

    if (existing) {
      await prisma.linkedInAccount.update({ where: { id: existing.id }, data: identity })
      updated++
    } else {
      await prisma.linkedInAccount.create({
        data: {
          workspaceId,
          provider: "HEYREACH",
          heyreachAccountId: account.id,
          workingHours: DEFAULT_WORKING_HOURS as unknown as Prisma.InputJsonValue,
          warmupStartAt: new Date(),
          ...identity,
        },
      })
      created++
    }
  }

  return { created, updated, total: remote.length }
}

function mapPlan(accountType?: string): "FREE" | "PREMIUM" | "SALES_NAVIGATOR" | "RECRUITER" {
  const value = (accountType ?? "").toLowerCase().replace(/[^a-z]/g, "")
  if (value.includes("salesnav")) return "SALES_NAVIGATOR"
  if (value.includes("recruiter")) return "RECRUITER"
  if (value.includes("premium")) return "PREMIUM"
  return "FREE"
}

/** Exactly one account may be the default; flipping one clears the rest. */
export async function setDefaultAccount(workspaceId: string, accountId: string) {
  await prisma.$transaction([
    prisma.linkedInAccount.updateMany({ where: { workspaceId }, data: { isDefault: false } }),
    prisma.linkedInAccount.update({ where: { id: accountId }, data: { isDefault: true } }),
  ])
}
