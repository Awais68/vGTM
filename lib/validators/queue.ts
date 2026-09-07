import { z } from "zod"

export const queueChannel = z.enum(["LINKEDIN_CONNECTION", "LINKEDIN_MESSAGE", "EMAIL"])

export const generateQueueSchema = z.object({
  campaignId: z.string().min(1),
  channel: queueChannel,
  stepNumber: z.number().int().min(0).max(6).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  tone: z.enum(["FRIENDLY_DIRECT", "FORMAL", "CASUAL", "CONSULTATIVE", "BLUNT"]).optional(),
  senderName: z.string().optional(),
  offerContext: z.string().optional(),
  assignSender: z.boolean().optional(),
  linkedInAccountId: z.string().min(1).nullable().optional(),
  ignoreSchedule: z.boolean().optional(),
})

export const updateQueueItemSchema = z.object({
  content: z.string().min(1).max(4000).optional(),
  status: z.enum(["DRAFT", "READY"]).optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
})

export const skipSchema = z.object({
  reason: z.string().max(300).optional(),
})

export const outcomeSchema = z.object({
  outcome: z.enum([
    "CONNECTION_ACCEPTED",
    "REPLIED",
    "INTERESTED",
    "NOT_INTERESTED",
    "MEETING_BOOKED",
    "UNSUBSCRIBED",
  ]),
  note: z.string().max(2000).optional(),
})

export const settingsSchema = z.object({
  senderName: z.string().max(120).nullable().optional(),
  senderTitle: z.string().max(160).nullable().optional(),
  defaultContext: z.string().max(4000).nullable().optional(),
  defaultTone: z
    .enum(["FRIENDLY_DIRECT", "FORMAL", "CASUAL", "CONSULTATIVE", "BLUNT"])
    .optional(),
  dailyConnectionLimit: z.number().int().min(1).max(100).optional(),
  dailyMessageLimit: z.number().int().min(1).max(200).optional(),
  autopilotEnabled: z.boolean().optional(),
  autopilotQueueTarget: z.number().int().min(1).max(200).optional(),
  timezone: z.string().max(64).optional(),
})
