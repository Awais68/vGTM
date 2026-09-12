import { prisma } from "@/lib/prisma"
import type { AutomationTrigger, Prisma, QueueChannel } from "@prisma/client"
import { generateQueue } from "@/lib/queue/service"
import { enrollLead } from "@/lib/sequences/engine"
import { getHeyReachClient } from "@/lib/heyreach/get-client"
import { pickSenderAccount } from "@/lib/linkedin/accounts"
import type {
  ActionOutcome,
  AutomationAction,
  AutomationConditions,
  TriggerContext,
} from "./types"

export interface RunTriggerInput {
  workspaceId: string
  trigger: AutomationTrigger
  campaignId?: string | null
  leadId?: string | null
  context?: TriggerContext
  /** Run rules even outside a sender's working hours (manual "run now"). */
  ignoreSchedule?: boolean
}

export interface RunTriggerResult {
  rulesEvaluated: number
  rulesRun: number
  affected: number
  outcomes: { ruleId: string; ruleName: string; outcomes: ActionOutcome[] }[]
}

/**
 * Runs every enabled rule bound to a trigger. Each rule gets its own
 * AutomationRun row so a misbehaving rule is visible instead of mysterious.
 * A failing rule never blocks the others.
 */
export async function runTrigger(input: RunTriggerInput): Promise<RunTriggerResult> {
  const { workspaceId, trigger, campaignId = null, leadId = null, context = {} } = input

  const rules = await prisma.automationRule.findMany({
    where: {
      workspaceId,
      enabled: true,
      trigger,
      // A rule with no campaign applies workspace-wide.
      ...(campaignId ? { OR: [{ campaignId }, { campaignId: null }] } : {}),
    },
    orderBy: { priority: "asc" },
  })

  const result: RunTriggerResult = {
    rulesEvaluated: rules.length,
    rulesRun: 0,
    affected: 0,
    outcomes: [],
  }

  for (const rule of rules) {
    const startedAt = Date.now()
    const actions = parseActions(rule.actions)
    const conditions = parseConditions(rule.conditions)
    const targetCampaignId = rule.campaignId ?? campaignId

    const outcomes: ActionOutcome[] = []

    for (const action of actions) {
      try {
        outcomes.push(
          await executeAction({
            action,
            conditions,
            workspaceId,
            campaignId: targetCampaignId,
            leadId,
            context,
            ignoreSchedule: input.ignoreSchedule ?? false,
          })
        )
      } catch (error) {
        outcomes.push({
          action: action.type,
          affected: 0,
          error: error instanceof Error ? error.message : "action failed",
        })
      }
    }

    const affected = outcomes.reduce((sum, o) => sum + o.affected, 0)
    const failures = outcomes.filter((o) => o.error).length

    result.rulesRun++
    result.affected += affected
    result.outcomes.push({ ruleId: rule.id, ruleName: rule.name, outcomes })

    await prisma.$transaction([
      prisma.automationRun.create({
        data: {
          workspaceId,
          ruleId: rule.id,
          trigger,
          status:
            failures === 0 ? "SUCCESS" : failures === outcomes.length ? "FAILED" : "PARTIAL",
          affected,
          message: outcomes.map((o) => o.error ?? o.message).filter(Boolean).join(" · ") || null,
          detail: outcomes as unknown as Prisma.InputJsonValue,
          durationMs: Date.now() - startedAt,
        },
      }),
      prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      }),
    ])
  }

  return result
}

interface ExecuteInput {
  action: AutomationAction
  conditions: AutomationConditions
  workspaceId: string
  campaignId: string | null
  leadId: string | null
  context: TriggerContext
  ignoreSchedule: boolean
}

async function executeAction(input: ExecuteInput): Promise<ActionOutcome> {
  const { action, conditions, workspaceId, campaignId, leadId, context, ignoreSchedule } = input
  const params = action.params ?? {}

  switch (action.type) {
    case "ENROLL_SEQUENCE": {
      if (!params.sequenceId) return { action: action.type, affected: 0, error: "No sequenceId set" }

      const leads = await selectLeads({ workspaceId, campaignId, leadId, conditions, context, take: 500 })
      let enrolled = 0
      for (const lead of leads) {
        const { outcome } = await enrollLead(lead.id, params.sequenceId)
        if (outcome !== "unchanged") enrolled++
      }
      return { action: action.type, affected: enrolled, message: `Enrolled ${enrolled} leads` }
    }

    case "GENERATE_DRAFTS": {
      if (!campaignId) return { action: action.type, affected: 0, error: "Rule has no campaign" }

      const channel = (params.channel ?? "LINKEDIN_CONNECTION") as QueueChannel

      if (conditions.maxPendingDrafts !== undefined) {
        const pending = await prisma.sendQueueItem.count({
          where: { workspaceId, campaignId, channel, status: { in: ["DRAFT", "READY"] } },
        })
        if (pending >= conditions.maxPendingDrafts) {
          return {
            action: action.type,
            affected: 0,
            message: `Queue already has ${pending} drafts — nothing generated`,
          }
        }
      }

      const generated = await generateQueue({
        workspaceId,
        campaignId,
        channel,
        limit: params.limit ?? 25,
        assignSender: true,
        ignoreSchedule,
      })

      return {
        action: action.type,
        affected: generated.created,
        message: `Drafted ${generated.created}${generated.blockedByCapacity ? " (stopped: senders at their daily cap)" : ""}`,
      }
    }

    case "PUSH_TO_HEYREACH": {
      if (!campaignId) return { action: action.type, affected: 0, error: "Rule has no campaign" }

      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { heyreachCampaignId: true },
      })
      if (!campaign?.heyreachCampaignId) {
        return { action: action.type, affected: 0, error: "Campaign is not linked to a HeyReach campaign" }
      }

      const leads = await selectLeads({
        workspaceId,
        campaignId,
        leadId,
        conditions: { ...conditions, hasLinkedIn: true },
        context,
        take: 500,
      })
      if (leads.length === 0) return { action: action.type, affected: 0, message: "No leads to push" }

      const client = await getHeyReachClient(workspaceId)
      const pushed = await client.addLeadsToCampaign(
        campaign.heyreachCampaignId,
        leads.map((l) => ({
          firstName: l.firstName,
          lastName: l.lastName ?? undefined,
          linkedinUrl: l.linkedinUrl!,
          email: l.email ?? undefined,
          company: l.company ?? undefined,
          jobTitle: l.jobTitle ?? undefined,
        }))
      )

      return {
        action: action.type,
        affected: pushed.addedLeadsCount + pushed.updatedLeadsCount,
        message: `HeyReach: +${pushed.addedLeadsCount} new, ${pushed.updatedLeadsCount} updated, ${pushed.failedLeadsCount} failed`,
      }
    }

    case "SET_LEAD_STATUS": {
      if (!params.status) return { action: action.type, affected: 0, error: "No status set" }
      const leads = await selectLeads({ workspaceId, campaignId, leadId, conditions, context, take: 1000 })
      if (leads.length === 0) return { action: action.type, affected: 0 }

      const updated = await prisma.lead.updateMany({
        where: { id: { in: leads.map((l) => l.id) } },
        data: { status: params.status },
      })
      return { action: action.type, affected: updated.count }
    }

    case "STOP_SEQUENCE": {
      const leads = await selectLeads({ workspaceId, campaignId, leadId, conditions, context, take: 1000 })
      if (leads.length === 0) return { action: action.type, affected: 0 }

      const stopped = await prisma.sequenceEnrollment.updateMany({
        where: { leadId: { in: leads.map((l) => l.id) }, status: "ACTIVE" },
        data: { status: "STOPPED", nextSendAt: null },
      })
      return { action: action.type, affected: stopped.count }
    }

    case "ASSIGN_SENDER": {
      const channel = (params.channel ?? "LINKEDIN_CONNECTION") as QueueChannel

      const unassigned = await prisma.sendQueueItem.findMany({
        where: {
          workspaceId,
          ...(campaignId ? { campaignId } : {}),
          channel,
          status: { in: ["DRAFT", "READY"] },
          linkedInAccountId: null,
        },
        select: { id: true },
        take: params.limit ?? 200,
      })

      let assigned = 0
      for (const item of unassigned) {
        const accountId =
          params.accountId ??
          (await pickSenderAccount({ workspaceId, channel, campaignId, ignoreSchedule: true }))?.accountId
        if (!accountId) break
        await prisma.sendQueueItem.update({ where: { id: item.id }, data: { linkedInAccountId: accountId } })
        assigned++
      }

      return { action: action.type, affected: assigned, message: `Assigned ${assigned} drafts to a sender` }
    }

    case "MARK_NEEDS_REVIEW": {
      const leads = await selectLeads({ workspaceId, campaignId, leadId, conditions, context, take: 1000 })
      if (leads.length === 0) return { action: action.type, affected: 0 }

      const marked = await prisma.sequenceEnrollment.updateMany({
        where: { leadId: { in: leads.map((l) => l.id) }, status: "ACTIVE" },
        data: { status: "NEEDS_REVIEW", nextSendAt: null },
      })
      return { action: action.type, affected: marked.count, message: params.note }
    }

    default:
      return { action: action.type, affected: 0, error: `Unknown action ${action.type}` }
  }
}

interface SelectLeadsInput {
  workspaceId: string
  campaignId: string | null
  leadId: string | null
  conditions: AutomationConditions
  context: TriggerContext
  take: number
}

/** Turns a rule's conditions into the actual set of leads it acts on. */
async function selectLeads(input: SelectLeadsInput) {
  const { workspaceId, campaignId, leadId, conditions, context, take } = input

  // Every OR goes inside AND. Two top-level `OR` keys in one object literal
  // silently overwrite each other, which used to drop the workspace filter
  // whenever daysSinceLastTouch was set and let a rule touch every tenant.
  const scope: Prisma.LeadWhereInput[] = [
    {
      OR: [
        { workspaceId },
        // Legacy rows with no workspaceId are only ours if their campaign is.
        { workspaceId: null, campaign: { workspaceId } },
      ],
    },
  ]

  if (conditions.daysSinceLastTouch !== undefined) {
    scope.push({
      OR: [{ lastTouchAt: null }, { lastTouchAt: { lte: daysAgo(conditions.daysSinceLastTouch) } }],
    })
  }

  const where: Prisma.LeadWhereInput = {
    unsubscribed: false,
    AND: scope,
    ...(campaignId ? { campaignId } : {}),
    ...(leadId ? { id: leadId } : {}),
    // A LEAD_IMPORTED run should only touch that import, not the whole table.
    ...(context.importBatchId ? { importBatchId: context.importBatchId } : {}),
    ...(conditions.leadStatus?.length ? { status: { in: conditions.leadStatus } } : {}),
    ...(conditions.hasLinkedIn ? { linkedinUrl: { not: null } } : {}),
    ...(conditions.hasEmail ? { email: { not: null } } : {}),
  }

  return prisma.lead.findMany({
    where,
    take,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      linkedinUrl: true,
      company: true,
      jobTitle: true,
    },
  })
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

export function parseActions(value: Prisma.JsonValue): AutomationAction[] {
  if (!Array.isArray(value)) return []
  return (value as unknown as AutomationAction[]).filter((a) => a && typeof a.type === "string")
}

export function parseConditions(value: Prisma.JsonValue | null): AutomationConditions {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as unknown as AutomationConditions
}
