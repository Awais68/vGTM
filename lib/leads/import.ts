import { prisma } from "@/lib/prisma"

export interface ParsedLead {
  firstName: string
  lastName: string | null
  email: string | null
  linkedinUrl: string | null
  company: string | null
  jobTitle: string | null
}

export interface ImportResult {
  imported: number
  updated: number
  failed: number
  errors: Array<{ row: number; message: string }>
}

export function parseLeadsCSV(csvContent: string): {
  valid: ParsedLead[]
  errors: Array<{ row: number; message: string }>
} {
  const lines = csvContent.trim().split("\n")
  if (lines.length < 2) {
    return { valid: [], errors: [{ row: 0, message: "CSV must have a header row and at least one data row" }] }
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const firstNameIdx = header.indexOf("firstname")
  const lastNameIdx = header.indexOf("lastname")
  const emailIdx = header.indexOf("email")
  const linkedinIdx = header.indexOf("linkedinurl")
  const companyIdx = header.indexOf("company")
  const jobTitleIdx = header.indexOf("jobtitle")

  if (firstNameIdx === -1) {
    return { valid: [], errors: [{ row: 0, message: "Missing required column: firstName" }] }
  }

  const valid: ParsedLead[] = []
  const errors: Array<{ row: number; message: string }> = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim())
    const row = i + 1

    const firstName = cols[firstNameIdx]
    if (!firstName) {
      errors.push({ row, message: "firstName is required" })
      continue
    }

    const email = emailIdx !== -1 ? cols[emailIdx] || null : null
    const linkedinUrl = linkedinIdx !== -1 ? cols[linkedinIdx] || null : null

    if (!email && !linkedinUrl) {
      errors.push({ row, message: "At least one of email or linkedinUrl is required" })
      continue
    }

    valid.push({
      firstName,
      lastName: lastNameIdx !== -1 ? cols[lastNameIdx] || null : null,
      email,
      linkedinUrl,
      company: companyIdx !== -1 ? cols[companyIdx] || null : null,
      jobTitle: jobTitleIdx !== -1 ? cols[jobTitleIdx] || null : null,
    })
  }

  return { valid, errors }
}

export async function importLeadsToDB(
  leads: ParsedLead[],
  campaignId: string
): Promise<ImportResult> {
  let imported = 0
  let updated = 0
  let failed = 0
  const errors: Array<{ row: number; message: string }> = []

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    const row = i + 2

    try {
      const where: Record<string, string> = {}
      if (lead.email) where.email = lead.email
      if (lead.linkedinUrl) where.linkedinUrl = lead.linkedinUrl

      if (Object.keys(where).length === 0) {
        failed++
        errors.push({ row, message: "No unique identifier (email or linkedinUrl)" })
        continue
      }

      const existing = await prisma.lead.findFirst({
        where: { OR: [lead.email ? { email: lead.email } : {}, lead.linkedinUrl ? { linkedinUrl: lead.linkedinUrl } : {}].filter((c) => Object.keys(c).length > 0) },
      })

      if (existing) {
        await prisma.lead.update({
          where: { id: existing.id },
          data: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email,
            linkedinUrl: lead.linkedinUrl,
            company: lead.company,
            jobTitle: lead.jobTitle,
            campaignId,
          },
        })
        updated++
      } else {
        await prisma.lead.create({
          data: {
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email,
            linkedinUrl: lead.linkedinUrl,
            company: lead.company,
            jobTitle: lead.jobTitle,
            campaignId,
          },
        })
        imported++
      }
    } catch {
      failed++
      errors.push({ row, message: "Database error importing lead" })
    }
  }

  return { imported, updated, failed, errors }
}
