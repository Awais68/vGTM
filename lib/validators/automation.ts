import { z } from "zod"

export const automationTrigger = z.enum([
  "LEAD_IMPORTED",
  "LEAD_STATUS_CHANGED",
  "CONNECTION_ACCEPTED",
  "REPLY_RECEIVED",
  "NO_REPLY_AFTER_DAYS",
  "QUEUE_LOW",
  "SCHEDULE",
])

const leadStatus = z.enum([
  "NEW",
  "CONTACTED",
  "CONNECTED",
  "REPLIED",
  "INTERESTED",
  "NOT_INTERESTED",
  "PROPOSAL_SENT",
])

export const automationAction = z.object({
  type: z.enum([
    "ENROLL_SEQUENCE",
    "GENERATE_DRAFTS",
    "PUSH_TO_HEYREACH",
    "SET_LEAD_STATUS",
    "STOP_SEQUENCE",
    "ASSIGN_SENDER",
    "MARK_NEEDS_REVIEW",
  ]),
  params: z
    .object({
      sequenceId: z.string().optional(),
      channel: z.enum(["LINKEDIN_CONNECTION", "LINKEDIN_MESSAGE", "EMAIL"]).optional(),
      limit: z.number().int().min(1).max(200).optional(),
      status: leadStatus.optional(),
      accountId: z.string().optional(),
      note: z.string().max(500).optional(),
    })
    .optional(),
})

export const automationConditions = z.object({
  leadStatus: z.array(leadStatus).optional(),
  hasLinkedIn: z.boolean().optional(),
  hasEmail: z.boolean().optional(),
  daysSinceLastTouch: z.number().int().min(0).max(365).optional(),
  maxPendingDrafts: z.number().int().min(0).max(1000).optional(),
})

export const createRuleSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  trigger: automationTrigger,
  campaignId: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  conditions: automationConditions.optional(),
  actions: z.array(automationAction).min(1).max(10),
})

export const updateRuleSchema = createRuleSchema.partial()

export const runNowSchema = z.object({
  trigger: automationTrigger.optional(),
  campaignId: z.string().nullable().optional(),
  ruleId: z.string().optional(),
})
