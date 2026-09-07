import type { LeadStatus, QueueChannel } from "@prisma/client"

export const ACTION_TYPES = [
  "ENROLL_SEQUENCE",
  "GENERATE_DRAFTS",
  "PUSH_TO_HEYREACH",
  "SET_LEAD_STATUS",
  "STOP_SEQUENCE",
  "ASSIGN_SENDER",
  "MARK_NEEDS_REVIEW",
] as const

export type ActionType = (typeof ACTION_TYPES)[number]

export interface AutomationAction {
  type: ActionType
  params?: {
    sequenceId?: string
    channel?: QueueChannel
    limit?: number
    status?: LeadStatus
    accountId?: string
    note?: string
  }
}

export interface AutomationConditions {
  leadStatus?: LeadStatus[]
  hasLinkedIn?: boolean
  hasEmail?: boolean
  /** Only touch leads whose last outbound touch is at least this old. */
  daysSinceLastTouch?: number
  /** Skip the rule while the queue already holds this many drafts. */
  maxPendingDrafts?: number
}

export interface TriggerContext {
  importBatchId?: string
  leadId?: string
  channel?: QueueChannel
  [key: string]: unknown
}

export interface ActionOutcome {
  action: ActionType
  affected: number
  message?: string
  error?: string
}
