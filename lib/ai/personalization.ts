import { generateText, streamText } from 'ai'
import { getAIModel } from './get-client'

export interface Lead {
  firstName: string
  lastName?: string | null
  company?: string | null
  jobTitle?: string | null
  linkedinUrl?: string | null
}

export interface ReplyClassification {
  intent: 'INTERESTED' | 'NOT_INTERESTED' | 'QUESTION' | 'OUT_OF_OFFICE' | 'OTHER'
  confidence: number
  suggestedAction: string
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(workspaceId: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(workspaceId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(workspaceId, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return
  }
  if (entry.count >= 50) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60000)
    throw new Error(`AI generation limit reached. Resets in ${minutesLeft} minutes.`)
  }
  entry.count++
}

export async function generateLinkedInConnectionNote(
  workspaceId: string,
  lead: Lead,
  senderName: string,
  context: string
): Promise<string> {
  checkRateLimit(workspaceId)
  const model = await getAIModel(workspaceId)

  const { text } = await generateText({
    model,
    prompt: `Write a LinkedIn connection request note. STRICT RULES:
- Maximum 300 characters (this is a hard LinkedIn limit)
- Do NOT say "I came across your profile" or "I noticed your profile"
- Sound human, not like a bot
- Mention something specific about their role or company
- End with a soft reason to connect
- Return ONLY the message, no quotes, no explanation

Lead info:
Name: ${lead.firstName} ${lead.lastName ?? ''}
Company: ${lead.company ?? 'their company'}
Job Title: ${lead.jobTitle ?? 'their role'}

You (sender): ${senderName}
Your offer context: ${context}`,
  })

  return text.trim().slice(0, 300)
}

export async function generateFollowUpMessage(
  workspaceId: string,
  lead: Lead,
  stepNumber: 1 | 2 | 3,
  context: string
): Promise<string> {
  checkRateLimit(workspaceId)
  const model = await getAIModel(workspaceId)

  const stepInstructions = {
    1: `Step 1 (First follow-up, 2 days after connection accepted):
- Lead with value, NOT a pitch
- Share one relevant insight or question about their industry
- Do not ask for a call or meeting
- Max 3 sentences`,
    2: `Step 2 (Second follow-up, 5 days after step 1 no reply):
- Reference your previous message briefly
- One soft CTA: "Would it make sense to chat for 15 mins?"
- Max 2-3 sentences`,
    3: `Step 3 (Breakup message, 10 days after step 2 no reply):
- Friendly, no guilt
- Leave door open: "No worries if timing isn't right..."
- Max 2 sentences`,
  }

  const { text } = await generateText({
    model,
    prompt: `Write a LinkedIn follow-up message for a cold outreach sequence.

${stepInstructions[stepNumber]}

Lead: ${lead.firstName} at ${lead.company ?? 'their company'} (${lead.jobTitle ?? ''})
Your offer: ${context}

Return ONLY the message text. No quotes. No subject line. Sound human.`,
  })

  return text.trim()
}

export async function classifyReply(
  workspaceId: string,
  messageContent: string
): Promise<ReplyClassification> {
  checkRateLimit(workspaceId)
  const model = await getAIModel(workspaceId)

  const { text } = await generateText({
    model,
    prompt: `Classify this LinkedIn reply. Return ONLY valid JSON, no markdown, no explanation.

Message: "${messageContent}"

Return this exact JSON shape:
{
  "intent": "INTERESTED" | "NOT_INTERESTED" | "QUESTION" | "OUT_OF_OFFICE" | "OTHER",
  "confidence": 0.0 to 1.0,
  "suggestedAction": "brief action string"
}

Examples:
- "Tell me more!" → INTERESTED, 0.95, "Send proposal"
- "Not interested thanks" → NOT_INTERESTED, 0.98, "Mark closed, remove from sequence"
- "What's your pricing?" → QUESTION, 0.90, "Reply with pricing info"
- "I'm OOO until Monday" → OUT_OF_OFFICE, 0.99, "Follow up after Monday"`,
  })

  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean) as ReplyClassification
  } catch {
    return { intent: 'OTHER', confidence: 0.5, suggestedAction: 'Review manually' }
  }
}

export async function generateProposal(
  workspaceId: string,
  lead: Lead,
  offerContext: string
): Promise<string> {
  checkRateLimit(workspaceId)
  const model = await getAIModel(workspaceId)

  const { text } = await generateText({
    model,
    maxOutputTokens: 800,
    prompt: `Write a professional business proposal in clean markdown.

Client info:
Name: ${lead.firstName} ${lead.lastName ?? ''}
Company: ${lead.company ?? ''}
Title: ${lead.jobTitle ?? ''}

Your offer: ${offerContext}

Structure:
1. Personalized opening (reference their company/role specifically)
2. Problem we understand you have
3. Our solution
4. What you get (3 bullet points)
5. Simple next step (one CTA)

Tone: Professional but conversational. No fluff. No buzzwords.
Length: 250-350 words.`,
  })

  return text.trim()
}
