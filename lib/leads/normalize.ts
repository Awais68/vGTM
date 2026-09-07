/**
 * Everything that turns a messy spreadsheet cell into something the rest of
 * the app can trust: header detection, value cleaning, and the dedupe key.
 */

export const CANONICAL_FIELDS = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "linkedinUrl",
  "company",
  "jobTitle",
  "phone",
  "location",
  "industry",
] as const

export type CanonicalField = (typeof CANONICAL_FIELDS)[number]

export type ColumnMapping = Partial<Record<CanonicalField, string>>

/** Header aliases, compared after stripping everything that isn't a letter or digit. */
const ALIASES: Record<CanonicalField, string[]> = {
  firstName: ["firstname", "first", "fname", "givenname", "forename", "vorname", "prenom"],
  lastName: ["lastname", "last", "lname", "surname", "familyname", "nachname"],
  fullName: ["fullname", "name", "contactname", "leadname", "prospectname", "person", "personname", "displayname"],
  email: ["email", "emailaddress", "workemail", "businessemail", "mail", "primaryemail", "emailid", "e"],
  linkedinUrl: [
    "linkedinurl",
    "linkedin",
    "linkedinprofile",
    "linkedinlink",
    "profileurl",
    "publicprofileurl",
    "personlinkedinurl",
    "linkedinprofileurl",
    "profile",
  ],
  company: ["company", "companyname", "organization", "organisation", "employer", "account", "accountname", "currentcompany", "org"],
  jobTitle: ["jobtitle", "title", "position", "role", "headline", "currentposition", "designation", "jobposition"],
  phone: ["phone", "phonenumber", "mobile", "mobilenumber", "cell", "cellphone", "contactnumber", "telephone", "tel"],
  location: ["location", "city", "country", "region", "address", "geo", "area", "state"],
  industry: ["industry", "sector", "vertical", "companyindustry"],
}

export function slugifyHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Best-effort mapping from the file's own columns to our fields.
 * Exact alias hits win; a substring hit is the fallback so
 * "Person Linkedin Url (from Apollo)" still lands on linkedinUrl.
 */
export function detectMapping(columns: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const taken = new Set<string>()
  const slugs = columns.map((c) => ({ raw: c, slug: slugifyHeader(c) }))

  for (const field of CANONICAL_FIELDS) {
    const aliases = ALIASES[field]

    const exact = slugs.find((c) => !taken.has(c.raw) && aliases.includes(c.slug))
    if (exact) {
      mapping[field] = exact.raw
      taken.add(exact.raw)
      continue
    }

    const partial = slugs.find(
      (c) => !taken.has(c.raw) && aliases.some((a) => a.length > 3 && c.slug.includes(a))
    )
    if (partial) {
      mapping[field] = partial.raw
      taken.add(partial.raw)
    }
  }

  return mapping
}

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null
  // Some exports pack several addresses into one cell.
  const first = value.split(/[,;]/)[0]?.trim().toLowerCase() ?? ""
  return EMAIL_RE.test(first) ? first : null
}

const LINKEDIN_SLUG_RE = /linkedin\.com\/(?:in|pub)\/([^/?#\s]+)/i

/**
 * Canonicalises to https://www.linkedin.com/in/<slug> so the same person
 * imported from two different tools dedupes correctly. URLs we can't parse
 * (Sales Navigator lead links, company pages) are kept verbatim rather than
 * dropped — they're still useful to a human.
 */
export function normalizeLinkedInUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  const raw = value.trim()
  if (!raw) return null

  const match = raw.match(LINKEDIN_SLUG_RE)
  if (match) {
    const slug = decodeURIComponent(match[1]).replace(/\/+$/, "").toLowerCase()
    return `https://www.linkedin.com/in/${slug}`
  }

  if (/^https?:\/\//i.test(raw)) return raw.replace(/[?#].*$/, "").replace(/\/+$/, "")
  // Bare slugs like "in/jane-doe" or "jane-doe" from hand-made sheets.
  if (/^(in\/)?[a-z0-9-]{3,}$/i.test(raw)) {
    return `https://www.linkedin.com/in/${raw.replace(/^in\//i, "").toLowerCase()}`
  }
  return null
}

export function splitFullName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().replace(/\s+/g, " ").split(" ")
  if (parts.length === 0 || !parts[0]) return { firstName: "", lastName: null }
  if (parts.length === 1) return { firstName: parts[0], lastName: null }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

export function cleanText(value: unknown, maxLength = 300): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim().replace(/\s+/g, " ")
  if (!text || text.toLowerCase() === "n/a" || text === "-") return null
  return text.slice(0, maxLength)
}

export function normalizePhone(value: unknown): string | null {
  const text = cleanText(value, 40)
  if (!text) return null
  const digits = text.replace(/[^\d+]/g, "")
  return digits.length >= 7 ? digits : null
}

/**
 * The key two rows must share to be considered the same person.
 * Email wins over LinkedIn because it's the stronger identifier.
 */
export function dedupeKey(lead: { email: string | null; linkedinUrl: string | null }): string | null {
  if (lead.email) return `email:${lead.email}`
  if (lead.linkedinUrl) return `li:${lead.linkedinUrl.toLowerCase()}`
  return null
}
