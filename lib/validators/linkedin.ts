import { z } from "zod"

const workingHourSlot = z.object({
  day: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
})

export const workingHoursSchema = z
  .array(workingHourSlot)
  .length(7)
  .refine((slots) => slots.every((s) => s.endHour > s.startHour), {
    message: "Each day's end hour must be after its start hour",
  })

export const createLinkedInAccountSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  profileUrl: z.string().url().nullable().optional(),
  subscription: z.enum(["FREE", "PREMIUM", "SALES_NAVIGATOR", "RECRUITER"]).optional(),
  timezone: z.string().max(64).optional(),
  dailyConnectionLimit: z.number().int().min(1).max(100).optional(),
  dailyMessageLimit: z.number().int().min(1).max(200).optional(),
  dailyInMailLimit: z.number().int().min(0).max(100).optional(),
  dailyProfileViewLimit: z.number().int().min(0).max(500).optional(),
  warmupEnabled: z.boolean().optional(),
  warmupDays: z.number().int().min(1).max(60).optional(),
  workingHours: workingHoursSchema.optional(),
  isDefault: z.boolean().optional(),
})

export const updateLinkedInAccountSchema = createLinkedInAccountSchema.partial().extend({
  status: z.enum(["ACTIVE", "PAUSED", "DISCONNECTED", "NEEDS_ATTENTION"]).optional(),
})

export const campaignSendersSchema = z.object({
  accountIds: z.array(z.string().min(1)).max(50),
})
