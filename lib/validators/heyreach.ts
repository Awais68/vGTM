import { z } from "zod"

export const addLeadsSchema = z.object({
  campaignId: z.number().int().positive(),
  leads: z
    .array(
      z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().optional(),
        linkedinUrl: z.string().url("Must be a valid URL"),
        email: z.string().email("Must be a valid email").optional(),
        company: z.string().optional(),
        jobTitle: z.string().optional(),
        customFields: z.record(z.string()).optional(),
      })
    )
    .min(1, "At least one lead is required"),
})

export const campaignFilterSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  campaignId: z.coerce.number().int().positive().optional(),
})

export const verifyApiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
})
