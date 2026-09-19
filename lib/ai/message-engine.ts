import { generateText } from "ai"
import { getAIModel } from "./get-client"
import { aiCallOptions } from "./timeout"
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
  industry?: string | null
  location?: string | null
  /** Extra columns from the import (website, notes, tech stack, ...). */
  customFields?: unknown
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

const MAX_CUSTOM_FIELD_CHARS = 300

/** Import extras (website, notes, tech stack, ...) as prompt lines. Skips empties. */
function customFieldLines(fields: unknown): string[] {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return []
  return Object.entries(fields as Record<string, unknown>)
    .filter(([, v]) => typeof v === "string" && v.trim().length > 0)
    .map(([k, v]) => `- ${k}: ${String(v).trim().slice(0, MAX_CUSTOM_FIELD_CHARS)}`)
}

function leadBlock(lead: LeadContext) {
  const lines = [
    `- Name: ${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}`,
    `- Role: ${lead.jobTitle ?? "unknown role"}`,
    `- Company: ${lead.company ?? "unknown company"}`,
    ...(lead.industry ? [`- Industry: ${lead.industry}`] : []),
    ...(lead.location ? [`- Location: ${lead.location}`] : []),
    ...customFieldLines(lead.customFields),
  ]
  return `THE PERSON (everything you know — use it, don't pad it):\n${lines.join("\n")}`
}

/** Concrete facts we hold about this lead. Empty means we only know a name. */
function knownFacts(lead: LeadContext): string[] {
  return [
    lead.company,
    lead.jobTitle,
    lead.industry,
    ...customFieldLines(lead.customFields).map((l) => l.replace(/^- [^:]+: /, "")),
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 1)
}

/**
 * Rule: every message is written for this one person. A draft that would read
 * the same if you swapped the lead out is rejected and re-drafted.
 */
function personalizationRules(lead: LeadContext) {
  const facts = knownFacts(lead)
  if (facts.length === 0) {
    return `PERSONALIZATION:
- We only know this person's name. Do NOT guess their company, role, or industry.
- Make the message specific to the offer instead: name one concrete situation the offer solves, and ask whether it applies to them.`
  }
  return `PERSONALIZATION (non-negotiable):
- This is NOT a template. Write it for ${lead.firstName} specifically, based on their company, role, industry and the details above.
- The first sentence must be about THEM (their company, role, industry, or a detail listed above) — never about you or your offer.
- Explicitly name at least one of: ${facts
    .slice(0, 4)
    .map((f) => `"${f}"`)
    .join(", ")}. Tie the offer to why it matters for someone in exactly that position.
- If the exact same message could be sent to a different person by only changing the name, it is wrong. Rewrite it.
- Never fill gaps with generic phrases like "companies like yours", "in your industry", "your business" when you have the real names.`
}

/** True when the draft names at least one concrete fact we know about the lead. */
export function isPersonalized(text: string, lead: LeadContext): boolean {
  const facts = knownFacts(lead)
  if (facts.length === 0) return true // nothing to check against
  const haystack = text.toLowerCase()
  return facts.some((fact) => {
    const f = fact.toLowerCase()
    if (haystack.includes(f)) return true
    // "Head of Growth" -> any two-word chunk; "Acme Inc." -> "acme"
    const words = f.split(/[^a-z0-9]+/).filter((w) => w.length > 3)
    return words.some((w) => haystack.includes(w))
  })
}

const GENERIC_MARKERS = ["companies like yours", "businesses like yours", "in your industry", "your organization"]

function isGeneric(text: string): boolean {
  const t = text.toLowerCase()
  return GENERIC_MARKERS.some((m) => t.includes(m))
}

export async function draftConnectionNote(
  workspaceId: string,
  lead: LeadContext,
  sender: SenderContext
): Promise<string> {
  const model = await getAIModel(workspaceId)

  const { text } = await generateText({
    ...aiCallOptions(),
    model,
    prompt: `Write a LinkedIn connection request note.

${leadBlock(lead)}

YOU ARE: ${sender.senderName}${sender.senderTitle ? `, ${sender.senderTitle}` : ""}
WHY YOU'RE REACHING OUT: ${sender.offerContext}

${personalizationRules(lead)}

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
    ...aiCallOptions(),
    model,
    prompt: `Write LinkedIn follow-up message #${stepNumber} in an outreach sequence.

${leadBlock(lead)}

YOU ARE: ${sender.senderName}${sender.senderTitle ? `, ${sender.senderTitle}` : ""}
WHAT YOU OFFER: ${sender.offerContext}
${history}
STEP BRIEF:
${stepBrief[stepNumber] ?? stepBrief[3]}

${personalizationRules(lead)}

${sharedRules(sender)}
- HARD LIMIT: 600 characters.`,
  })

  return clean(text).slice(0, 600)
}

export async function draftEmail(
  workspaceId: string,
  lead: LeadContext,
  sender: SenderContext,
  stepNumber: number,
  previousMessages: string[] = []
): Promise<{ subject: string; body: string }> {
  const model = await getAIModel(workspaceId)

  const emailBrief: Record<number, string> = {
    1: `First email. Open with something specific to them, one line on why the offer fits their exact situation, one low-pressure question. No meeting ask.`,
    2: `Second email, no reply. One line referencing the first email, one new concrete reason this matters for their company right now, one soft ask for 15 minutes.`,
    3: `Third email, still no reply. Offer something free and specific to their company (a teardown, a short audit, an answer to a question they likely have). No pressure.`,
    4: `Breakup email. Friendly, say you'll stop emailing, leave the door open. Two sentences.`,
  }

  const history = previousMessages.length
    ? `\nWHAT YOU ALREADY SENT THEM (do not repeat these points or phrasing):\n${previousMessages
        .map((m, i) => `${i + 1}. ${m}`)
        .join("\n")}\n`
    : ""

  const basePrompt = `Write a cold outreach email (touch #${stepNumber}).

${leadBlock(lead)}

YOU ARE: ${sender.senderName}${sender.senderTitle ? `, ${sender.senderTitle}` : ""}
WHAT YOU OFFER: ${sender.offerContext}
${history}
STEP BRIEF:
${emailBrief[stepNumber] ?? emailBrief[3]}

${personalizationRules(lead)}

${sharedRules(sender)}
- Under 120 words in the body.
- Do NOT start the body with a greeting like "Hi ${lead.firstName}," — the email template adds it.
- Subject line under 50 characters, lowercase, no clickbait. Name their company or role in the subject when you know it.

Return exactly this format and nothing else:
SUBJECT: <subject line>
BODY:
<body text>`

  const generate = async (extra = "") => {
    const { text } = await generateText({ ...aiCallOptions(), model, prompt: basePrompt + extra })
    return parseEmail(text, lead)
  }

  let email = await generate()

  // Enforce the rule, don't just ask for it: one retry with the failure spelled out.
  if (!isPersonalized(email.body, lead) || isGeneric(email.body)) {
    email = await generate(`

YOUR PREVIOUS ATTEMPT WAS REJECTED: it was generic and did not mention ${knownFacts(lead)
      .slice(0, 2)
      .map((f) => `"${f}"`)
      .join(" or ")}. Rewrite it so the first sentence is about them and names a real detail from THE PERSON block.`)
  }

  if (!isPersonalized(email.body, lead) || isGeneric(email.body)) {
    throw new Error(
      `Draft for ${lead.firstName} was too generic (no reference to ${knownFacts(lead)[0]}). Add more lead detail or regenerate.`
    )
  }

  return email
}

function parseEmail(text: string, lead: LeadContext): { subject: string; body: string } {
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
