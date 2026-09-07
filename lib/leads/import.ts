import { prisma } from "@/lib/prisma"
import type { ImportSource, Prisma } from "@prisma/client"
import {
  cleanText,
  dedupeKey,
  normalizeEmail,
  normalizeLinkedInUrl,
  normalizePhone,
  splitFullName,
  type ColumnMapping,
} from "./normalize"
import type { HeuristicLead } from "./text-heuristics"
import { parseDelimitedText } from "./parsers/csv"
import { detectMapping } from "./normalize"

export interface ParsedLead {
  firstName: string
  lastName: string | null
  email: string | null
  linkedinUrl: string | null
  company: string | null
  jobTitle: string | null
  phone: string | null
  location: string | null
  industry: string | null
  customFields: Record<string, string> | null
}

export interface RowError {
  row: number
  message: string
}

export interface MappingResult {
  valid: ParsedLead[]
  errors: RowError[]
  /** Rows dropped because an earlier row in the same file was the same person. */
  duplicatesInFile: number
}

export interface ImportResult {
  imported: number
  updated: number
  skipped: number
  failed: number
  errors: RowError[]
  batchId?: string
}

const CORE_FIELDS: (keyof ParsedLead)[] = [
  "firstName",
  "lastName",
  "email",
  "linkedinUrl",
  "company",
  "jobTitle",
  "phone",
  "location",
  "industry",
]

/**
 * Applies an operator-confirmed column mapping to raw rows.
 *
 * A lead needs a name plus at least one way to reach them; anything else is
 * reported as a row error rather than silently dropped, so the import screen
 * can show exactly which rows failed and why.
 */
export function applyMapping(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  options: { keepUnmappedColumns?: boolean } = {}
): MappingResult {
  const valid: ParsedLead[] = []
  const errors: RowError[] = []
  const seen = new Set<string>()
  let duplicatesInFile = 0

  const mappedColumns = new Set(Object.values(mapping).filter(Boolean) as string[])

  rows.forEach((row, index) => {
    const rowNumber = index + 2 // +1 for the header, +1 for 1-based display

    let firstName = cleanText(mapping.firstName ? row[mapping.firstName] : null, 80) ?? ""
    let lastName = cleanText(mapping.lastName ? row[mapping.lastName] : null, 80)

    if (!firstName && mapping.fullName) {
      const full = cleanText(row[mapping.fullName], 160)
      if (full) {
        const split = splitFullName(full)
        firstName = split.firstName
        lastName = lastName ?? split.lastName
      }
    }

    const email = normalizeEmail(mapping.email ? row[mapping.email] : null)
    const linkedinUrl = normalizeLinkedInUrl(mapping.linkedinUrl ? row[mapping.linkedinUrl] : null)

    if (!firstName) {
      errors.push({ row: rowNumber, message: "No first name — map a First name or Full name column" })
      return
    }

    if (!email && !linkedinUrl) {
      errors.push({ row: rowNumber, message: "Needs an email or a LinkedIn URL" })
      return
    }

    const key = dedupeKey({ email, linkedinUrl })
    if (key && seen.has(key)) {
      duplicatesInFile++
      return
    }
    if (key) seen.add(key)

    let customFields: Record<string, string> | null = null
    if (options.keepUnmappedColumns) {
      const extras: Record<string, string> = {}
      for (const [column, value] of Object.entries(row)) {
        if (mappedColumns.has(column)) continue
        const clean = cleanText(value, 200)
        if (clean) extras[column] = clean
      }
      if (Object.keys(extras).length > 0) customFields = extras
    }

    valid.push({
      firstName,
      lastName,
      email,
      linkedinUrl,
      company: cleanText(mapping.company ? row[mapping.company] : null, 160),
      jobTitle: cleanText(mapping.jobTitle ? row[mapping.jobTitle] : null, 160),
      phone: normalizePhone(mapping.phone ? row[mapping.phone] : null),
      location: cleanText(mapping.location ? row[mapping.location] : null, 160),
      industry: cleanText(mapping.industry ? row[mapping.industry] : null, 120),
      customFields,
    })
  })

  return { valid, errors, duplicatesInFile }
}

/** Extraction output already uses canonical field names. */
export function leadsFromExtraction(extracted: HeuristicLead[]): MappingResult {
  const rows = extracted.map((lead) => ({
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    linkedinUrl: lead.linkedinUrl,
    company: lead.company,
    jobTitle: lead.jobTitle,
  }))

  return applyMapping(rows, {
    firstName: "firstName",
    lastName: "lastName",
    email: "email",
    linkedinUrl: "linkedinUrl",
    company: "company",
    jobTitle: "jobTitle",
  })
}

export interface CommitOptions {
  workspaceId: string
  campaignId?: string | null
  leads: ParsedLead[]
  source?: ImportSource
  fileName?: string
  fileType?: string
  mapping?: ColumnMapping
  totalRows?: number
  parseErrors?: RowError[]
  /** Overwrite fields on a lead we already have. Off means "add new only". */
  updateExisting?: boolean
}

/**
 * Writes the leads and records an ImportBatch so a bad import can be traced
 * (and, later, undone) instead of vanishing into the leads table.
 */
export async function commitImport(options: CommitOptions): Promise<ImportResult> {
  const {
    workspaceId,
    campaignId = null,
    leads,
    source = "FILE",
    fileName = "manual",
    fileType = "csv",
    mapping,
    totalRows,
    parseErrors = [],
    updateExisting = true,
  } = options

  const batch = await prisma.importBatch.create({
    data: {
      workspaceId,
      campaignId,
      fileName,
      fileType,
      source,
      totalRows: totalRows ?? leads.length,
      status: "PARSED",
      mapping: (mapping ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  })

  const emails = leads.map((l) => l.email).filter((e): e is string => !!e)
  const urls = leads.map((l) => l.linkedinUrl).filter((u): u is string => !!u)

  // One lookup for the whole file instead of a query per row.
  const existing =
    emails.length || urls.length
      ? await prisma.lead.findMany({
          where: {
            OR: [
              ...(emails.length ? [{ email: { in: emails } }] : []),
              ...(urls.length ? [{ linkedinUrl: { in: urls } }] : []),
            ],
            // Legacy rows predate workspace scoping; treat them as ours.
            AND: [{ OR: [{ workspaceId }, { workspaceId: null }] }],
          },
          select: { id: true, email: true, linkedinUrl: true },
        })
      : []

  const existingByKey = new Map<string, string>()
  for (const lead of existing) {
    const key = dedupeKey({ email: lead.email, linkedinUrl: lead.linkedinUrl })
    if (key) existingByKey.set(key, lead.id)
  }

  const result: ImportResult = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [...parseErrors],
    batchId: batch.id,
  }

  const toCreate: Prisma.LeadCreateManyInput[] = []

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const key = dedupeKey({ email: lead.email, linkedinUrl: lead.linkedinUrl })
    const existingId = key ? existingByKey.get(key) : undefined

    if (existingId) {
      if (!updateExisting) {
        result.skipped++
        continue
      }
      try {
        await prisma.lead.update({
          where: { id: existingId },
          data: {
            ...pickDefined(lead),
            workspaceId,
            ...(campaignId ? { campaignId } : {}),
            importBatchId: batch.id,
            source,
          },
        })
        result.updated++
      } catch {
        result.failed++
        result.errors.push({ row: i + 2, message: "Could not update the existing lead" })
      }
      continue
    }

    toCreate.push({
      workspaceId,
      campaignId,
      importBatchId: batch.id,
      source,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      linkedinUrl: lead.linkedinUrl,
      company: lead.company,
      jobTitle: lead.jobTitle,
      phone: lead.phone,
      location: lead.location,
      industry: lead.industry,
      customFields: (lead.customFields ?? undefined) as Prisma.InputJsonValue | undefined,
    })
  }

  if (toCreate.length > 0) {
    // createMany in chunks: one giant statement is what actually times out on
    // a pooled Postgres connection.
    for (let i = 0; i < toCreate.length; i += 500) {
      const slice = toCreate.slice(i, i + 500)
      try {
        const created = await prisma.lead.createMany({ data: slice })
        result.imported += created.count
      } catch {
        result.failed += slice.length
        result.errors.push({ row: 0, message: `Failed to insert ${slice.length} leads` })
      }
    }
  }

  if (campaignId) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { totalCount: { increment: result.imported } },
    })
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: result.failed > 0 && result.imported === 0 ? "FAILED" : "COMPLETED",
      imported: result.imported,
      updated: result.updated,
      skipped: result.skipped,
      failed: result.failed,
      errors: result.errors.slice(0, 200) as unknown as Prisma.InputJsonValue,
      completedAt: new Date(),
    },
  })

  return result
}

function pickDefined(lead: ParsedLead) {
  const data: Record<string, unknown> = {}
  for (const field of CORE_FIELDS) {
    const value = lead[field]
    if (value !== null && value !== undefined && value !== "") data[field] = value
  }
  return data
}

/**
 * Back-compat helper for the original CSV-only path.
 * New code should go through parseUpload() + applyMapping().
 */
export function parseLeadsCSV(csvContent: string): { valid: ParsedLead[]; errors: RowError[] } {
  const table = parseDelimitedText(csvContent)
  const mapping = detectMapping(table.columns)
  const { valid, errors } = applyMapping(table.rows, mapping)
  return { valid, errors }
}
