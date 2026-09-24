import { detectMapping, normalizeEmail, normalizeLinkedInUrl, splitFullName } from "./normalize"

const EMAIL_GLOBAL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const LINKEDIN_GLOBAL = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:in|pub)\/[^\s,;)"']+/gi
const NAME_LINE = /^[A-Z][\p{L}'’.-]+(?: [A-Z][\p{L}'’.-]+){1,3}$/u
const TITLE_AT_COMPANY = /^(.{2,80}?)\s+(?:at|@|\||–|-)\s+(.{2,80})$/i

/**
 * Some PDFs and Word docs are just a printed table. If the text splits
 * cleanly on tabs or pipes and the first line reads like a header, we can
 * recover real columns instead of guessing per line.
 */
export function tableFromPlainText(
  text: string
): { columns: string[]; rows: Record<string, string>[] } | null {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return null

  for (const delimiter of [/\t+/, /\s*\|\s*/, / {2,}/]) {
    const header = lines[0].split(delimiter).map((c) => c.trim()).filter(Boolean)
    if (header.length < 2) continue

    // The header has to actually look like lead columns, otherwise we would
    // happily turn a paragraph of prose into a two-column table.
    const mapped = Object.keys(detectMapping(header)).length
    if (mapped < 2) continue

    const rows: Record<string, string>[] = []
    let malformed = 0

    for (const line of lines.slice(1)) {
      const cells = line.split(delimiter).map((c) => c.trim())
      if (cells.length < header.length - 1) {
        malformed++
        continue
      }
      const row: Record<string, string> = {}
      header.forEach((col, i) => {
        row[col] = cells[i] ?? ""
      })
      rows.push(row)
    }

    if (rows.length >= 1 && malformed <= rows.length) {
      return { columns: header, rows }
    }
  }

  return null
}

export interface HeuristicLead {
  firstName: string
  lastName: string
  email: string
  linkedinUrl: string
  company: string
  jobTitle: string
}

/**
 * Deterministic fallback for unstructured documents: anchor on every email
 * address and LinkedIn URL, then read the few lines around it for a name,
 * a title and a company. Deliberately dumb — it exists so an import still
 * works when no AI key is configured.
 */
export function extractLeadsFromText(text: string): HeuristicLead[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const byKey = new Map<string, HeuristicLead>()

  const anchors: { line: number; email: string | null; linkedinUrl: string | null }[] = []

  lines.forEach((line, index) => {
    const emails = line.match(EMAIL_GLOBAL) ?? []
    const urls = line.match(LINKEDIN_GLOBAL) ?? []
    const count = Math.max(emails.length, urls.length)
    for (let i = 0; i < count; i++) {
      anchors.push({
        line: index,
        email: normalizeEmail(emails[i] ?? emails[0] ?? ""),
        linkedinUrl: normalizeLinkedInUrl(urls[i] ?? urls[0] ?? ""),
      })
    }
  })

  for (const anchor of anchors) {
    const key = anchor.email ?? anchor.linkedinUrl
    if (!key || byKey.has(key)) continue

    const window = lines.slice(Math.max(0, anchor.line - 3), anchor.line + 4)

    let name = window.find((l) => NAME_LINE.test(l)) ?? ""
    let jobTitle = ""
    let company = ""

    for (const line of window) {
      const match = line.match(TITLE_AT_COMPANY)
      if (match && !EMAIL_GLOBAL.test(match[0])) {
        jobTitle = match[1].trim()
        company = match[2].trim()
        break
      }
    }

    // Fall back to the local part of the email: "jane.doe@acme.com" is still
    // a better first name than nothing.
    if (!name && anchor.email) {
      const local = anchor.email.split("@")[0].replace(/[._-]+/g, " ").replace(/\d+/g, "").trim()
      name = local.replace(/\b\w/g, (c) => c.toUpperCase())
    }

    const { firstName, lastName } = splitFullName(name)
    if (!firstName) continue

    byKey.set(key, {
      firstName,
      lastName: lastName ?? "",
      email: anchor.email ?? "",
      linkedinUrl: anchor.linkedinUrl ?? "",
      company,
      jobTitle,
    })
  }

  return [...byKey.values()]
}
