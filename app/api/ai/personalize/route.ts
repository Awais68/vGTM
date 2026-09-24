import { streamText } from 'ai'
import { getAIModel } from '@/lib/ai/get-client'
import { aiCallOptions, describeAiError } from '@/lib/ai/timeout'
import { NextRequest } from 'next/server'
import { requireWorkspace } from '@/lib/auth/get-current-user'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const bodySchema = z.object({
  leadId: z.string(),
  type: z.enum(['connection', 'followup', 'proposal']),
  stepNumber: z.number().min(1).max(3).optional(),
  senderName: z.string(),
  context: z.string(),
})

export async function POST(req: NextRequest) {
  try {
    const dbUser = await requireWorkspace()
    if (!dbUser) return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const body = bodySchema.parse(await req.json())

    const lead = await prisma.lead.findUnique({ where: { id: body.leadId } })
    if (!lead) return Response.json({ success: false, error: 'Lead not found' }, { status: 404 })

    const model = await getAIModel(dbUser.workspaceId)

    const prompts = {
      connection: `Write a LinkedIn connection note under 300 chars for ${lead.firstName} at ${lead.company}. Context: ${body.context}. Sender: ${body.senderName}. Return only the message.`,
      followup: `Write LinkedIn follow-up step ${body.stepNumber ?? 1} for ${lead.firstName} at ${lead.company}. Context: ${body.context}. Return only the message.`,
      proposal: `Write a short proposal for ${lead.firstName} at ${lead.company} (${lead.jobTitle}). Offer: ${body.context}. Return clean markdown.`,
    }

    const result = streamText({
      ...aiCallOptions(),
      model,
      prompt: prompts[body.type],
    })

    return result.toTextStreamResponse()
  } catch (err) {
    const message = describeAiError(err)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
