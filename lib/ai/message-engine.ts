import { generateText } from "ai"
import { getAIModel } from "./get-client"
import { prisma } from "@/lib/prisma"

export type Tone = "FRIENDLY_DIRECT" | "FORMAL" | "CASUAL" | "CONSULTATIVE" | "BLUNT"

export const TONE_GUIDE: Record<Tone, string> = {
  FRIENDLY_DIRECT: "Warm but straight to the point. No corporate filler.",
  FORMAL: "Professional and precise. Full sentences, no slang, no emoji.",
  CASUAL: "Relaxed and conversational, like messaging a peer you respect.",
  CONSULTATIVE: "Advisory. Lead with an observation about their business, not your offer.",
  BLUNT: "Very short and plain. Say the thing in one or two sentences and stop.",
}

export interface LeadContext {
  firstName: string
  lastName?: string | null
  company?: string | null
  jobTitle?: string | null
  linkedinUrl?: string | null
}

export interface SenderContext {
  senderName: string
  senderTitle?: string | null
  offerContext: string
  tone: Tone
}

/** Loaded once per generation batch so we don't hit the DB per lead. */
export async function loadSenderContext(
  workspaceId: string,
  overrides: Partial<SenderContext> = {}
): Promise<SenderContext> {
  const setting = await prisma.workspaceSetting.findUnique({ where: { workspaceId } })

  return {
    senderName: overrides.senderName ?? setting?.senderName ?? "there",
    senderTitle: overrides.senderTitle ?? setting?.senderTitle ?? null,
    offerContext:
      overrides.offerContext ?? setting?.defaultContext ?? "a service relevant to their role",
    tone: overrides.tone ?? ((setting?.defaultTone as Tone) ?? "FRIENDLY_DIRECT"),
  }
}

const BANNED_OPENERS = [
  "I came across your profile",
  "I noticed your profile",
  "I hope this message finds you well",
  "I stumbled upon",
  "As a fellow",
]

function sharedRules(sender: SenderContext) {
  return `TONE: ${TONE_GUIDE[sender.tone]}

HARD RULES:
- Never use these openers: ${BANNED_OPENERS.map((o) => `"${o}"`).join(", ")}
- No emoji. No hashtags. No markdown. No quotation marks around the message.
- Do not invent facts about the person or their company. If you don't know something, don't reference it.
- Write like one human to another, not like marketing copy.
- Return ONLY the message body. No subject line, no preamble, no explanation.`
}

function leadBlock(lead: LeadContext) {
  return `THE PERSON:
- Name: ${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}
- Role: ${lead.jobTitle ?? "unknown role"}
- Company: ${lead.company ?? "unknown company"}`
}

export async function draftConnectionNote(
  workspaceId: string,
  lead: LeadContext,
  sender: SenderContext
): Promise<string> {
  const model = await getAIModel(workspaceId)

  const { text } = await generateText({
    model,
    prompt: `Write a LinkedIn connection request note.

${leadBlock(lead)}

YOU ARE: ${sender.senderName}${sender.senderTitle ? `, ${sender.senderTitle}` : ""}
WHY YOU'RE REACHING OUT: ${sender.offerContext}

${sharedRules(sender)}
- HARD LIMIT: 280 characters. LinkedIn cuts off at 300; stay under 280.
- Reference their role or company in a way that could only apply to them.
- End with a low-pressure reason to connect, not a pitch and not a meeting ask.`,
  })

  return clean(text).slice(0, 280)
}

export async function draftFollowUp(
  workspaceId: string,
  lead: LeadContext,
  sender: SenderContext,
  stepNumber: number,
  previousMessages: string[] = []
): Promise<string> {
  const model = await getAIModel(workspaceId)

  const stepBrief: Record<number, string> = {
    1: `First message after they accepted the connection.
- Thank them in at most half a sentence, then move on.
- Give one useful observation or question about their world.
- Do NOT ask for a call. Do NOT pitch.
- Max 3 sentences.`,
    2: `Second touch, no reply to the first.
- One line referencing the earlier message.
- One concrete reason this could be relevant to them right now.
- One soft ask: "worth a quick 15 minutes?"
- Max 4 sentences.`,
    3: `Third touch, still no reply.
- Offer something with no strings attached (a resource, a teardown, a short answer).
- Still no pressure.
- Max 3 sentences.`,
    4: `Breakup message.
- Friendly, zero guilt, explicitly say you'll stop following up.
- Leave the door open for them to reply later.
- Max 2 sentences.`,
  }

  const history = previousMessages.length
    ? `\nWHAT YOU ALREADY SENT THEM (do not repeat these points or phrasing):\n${previousMessages
        .map((m, i) => `${i + 1}. ${m}`)
        .join("\n")}\n`
    : ""

  const { text } = await generateText({
    model,
    prompt: `Write LinkedIn follow-up message #${stepNumber} in an outreach sequence.

${leadBlock(lead)}

YOU ARE: ${sender.senderName}${sender.senderTitle ? `, ${sender.senderTitle}` : ""}
WHAT YOU OFFER: ${sender.offerContext}
${history}
STEP BRIEF:
${stepBrief[stepNumber] ?? stepBrief[3]}

${sharedRules(sender)}
- HARD LIMIT: 600 characters.`,
  })

  return clean(text).slice(0, 600)
}

export async function draftEmail(
  workspaceId: string,
  lead: LeadContext,
  sender: SenderContext,
  stepNumber: number
): Promise<{ subject: string; body: string }> {
  const model = await getAIModel(workspaceId)

  const { text } = await generateText({
    model,
    prompt: `Write a cold outreach email (touch #${stepNumber}).

${leadBlock(lead)}

YOU ARE: ${sender.senderName}${sender.senderTitle ? `, ${sender.senderTitle}` : ""}
WHAT YOU OFFER: ${sender.offerContext}

${sharedRules(sender)}
- Under 120 words in the body.
- Subject line under 50 characters, lowercase, no clickbait.

Return exactly this format and nothing else:
SUBJECT: <subject line>
BODY:
<body text>`,
  })

  const match = /SUBJECT:\s*(.+?)\n+BODY:\s*([\s\S]+)/i.exec(text.trim())
  if (!match) return { subject: `quick question, ${lead.firstName}`, body: clean(text) }

  return { subject: clean(match[1]).slice(0, 120), body: clean(match[2]) }
}

/** Strips the wrappers models keep adding despite being told not to. */
function clean(text: string): string {
  return text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```$/, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
}
