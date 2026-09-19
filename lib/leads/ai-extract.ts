import { generateObject } from "ai"
import { z } from "zod"
import { getAIModel } from "@/lib/ai/get-client"
import { AI_JOB_TIMEOUT_MS, aiCallOptions, describeAiError } from "@/lib/ai/timeout"
import { extractLeadsFromText, type HeuristicLead } from "./text-heuristics"

const LeadSchema = z.object({
  firstName: z.string().describe("Given name only, never the full name"),
  lastName: z.string().describe("Family name, empty string if unknown"),
  email: z.string().describe("Email address, empty string if not present"),
  linkedinUrl: z.string().describe("Full LinkedIn profile URL, empty string if not present"),
  company: z.string().describe("Current employer, empty string if unknown"),
  jobTitle: z.string().describe("Current role, empty string if unknown"),
})

const ExtractionSchema = z.object({
  leads: z.array(LeadSchema),
})

/** Long documents are chunked so a single call never blows the context window. */
const CHUNK_CHARS = 12000

export interface AiExtractionResult {
  leads: HeuristicLead[]
  method: "ai" | "heuristic"
  warning?: string
}

/**
 * Turns unstructured text (a PDF, a Word doc, a pasted list) into lead rows.
 * Tries the workspace's AI model first and silently falls back to the regex
 * extractor when no key is configured or the model call fails — an import
 * that returns something is better than an import that errors out.
 */
export async function extractLeadsWithAI(
  workspaceId: string,
  text: string
): Promise<AiExtractionResult> {
  const trimmed = text.trim()
  if (!trimmed) return { leads: [], method: "heuristic" }

  try {
    const model = await getAIModel(workspaceId)
    const chunks = chunk(trimmed, CHUNK_CHARS)
    const collected: HeuristicLead[] = []
    // One budget for the whole document, not per chunk: eight slow chunks
    // would otherwise outlast the request itself.
    const deadline = Date.now() + AI_JOB_TIMEOUT_MS
    let ranOutOfTime = false

    for (const part of chunks.slice(0, 8)) {
      const remaining = deadline - Date.now()
      if (remaining <= 1_000) {
        ranOutOfTime = true
        break
      }

      const { object } = await generateObject({
        ...aiCallOptions(remaining),
        model,
        schema: ExtractionSchema,
        prompt: `Extract every person who could be an outreach lead from the document below.

RULES:
- Only include real people. Ignore company-only entries, page headers, footers and legal text.
- Never invent an email address or a LinkedIn URL. If it is not in the text, return an empty string.
- Split names into firstName and lastName. Do not put a full name in firstName.
- Return an empty array if the document contains no people.

DOCUMENT:
${part}`,
      })

      for (const lead of object.leads) {
        if (!lead.firstName?.trim()) continue
        collected.push({
          firstName: lead.firstName.trim(),
          lastName: lead.lastName?.trim() ?? "",
          email: lead.email?.trim() ?? "",
          linkedinUrl: lead.linkedinUrl?.trim() ?? "",
          company: lead.company?.trim() ?? "",
          jobTitle: lead.jobTitle?.trim() ?? "",
        })
      }
    }

    const warning = ranOutOfTime
      ? "AI ran out of time on this document — only the part read so far is shown."
      : chunks.length > 8
        ? "Document was long — only the first 8 chunks were read."
        : undefined

    // A model that returns nothing on a document that clearly has emails in it
    // is worse than the regex pass, so cross-check.
    if (collected.length === 0) {
      const fallback = extractLeadsFromText(trimmed)
      if (fallback.length > 0) {
        return { leads: fallback, method: "heuristic", warning: "AI found no leads; used pattern matching instead." }
      }
    }

    return { leads: dedupe(collected), method: "ai", warning }
  } catch (error) {
    const reason = describeAiError(error)
    return {
      leads: extractLeadsFromText(trimmed),
      method: "heuristic",
      warning: `${reason} — fell back to pattern matching.`,
    }
  }
}

function chunk(text: string, size: number): string[] {
  if (text.length <= size) return [text]
  const parts: string[] = []
  for (let i = 0; i < text.length; i += size) parts.push(text.slice(i, i + size))
  return parts
}

function dedupe(leads: HeuristicLead[]): HeuristicLead[] {
  const seen = new Map<string, HeuristicLead>()
  for (const lead of leads) {
    const key = (lead.email || lead.linkedinUrl || `${lead.firstName} ${lead.lastName} ${lead.company}`)
      .toLowerCase()
      .trim()
    if (!seen.has(key)) seen.set(key, lead)
  }
  return [...seen.values()]
}
