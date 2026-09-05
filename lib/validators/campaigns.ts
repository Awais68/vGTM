import { z } from "zod"

export const createCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  offerContext: z.string().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email("Must be a valid email").optional(),
})

export const sequenceStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  type: z.enum(["EMAIL", "FOLLOW_UP", "CONNECTION_REQUEST", "LINKEDIN_MESSAGE"]),
  subject: z.string().optional(),
  template: z.string().min(1, "Template content is required"),
  delayDays: z.number().int().min(0).default(1),
})

export const saveSequenceSchema = z.object({
  name: z.string().min(1).default("Email Sequence"),
  steps: z.array(sequenceStepSchema).min(1, "At least one step is required"),
})
