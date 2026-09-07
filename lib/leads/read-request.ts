import { MAX_UPLOAD_BYTES, parsePastedText, parseUpload, type RawTable } from "./parsers"
import { extractLeadsWithAI } from "./ai-extract"
import { leadsFromExtraction, type MappingResult } from "./import"
import { detectMapping, type ColumnMapping } from "./normalize"

export interface ReadRequestResult {
  table: RawTable
  mapping: ColumnMapping
  /** Set when the source was a document and we had to extract rather than map. */
  extraction?: MappingResult & { method: "ai" | "heuristic" }
  fileName: string
}

export class ImportInputError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
    this.name = "ImportInputError"
  }
}

/**
 * Normalises "a file upload" and "some pasted text" into one shape, and runs
 * extraction for formats that have no columns of their own (PDF, DOCX, prose).
 */
export async function readImportInput(
  formData: FormData,
  workspaceId: string
): Promise<ReadRequestResult> {
  const file = formData.get("file")
  const pasted = formData.get("text")

  let table: RawTable
  let fileName: string

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new ImportInputError(
        `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB`,
        "FILE_TOO_LARGE"
      )
    }
    table = await parseUpload(file)
    fileName = file.name
  } else if (typeof pasted === "string" && pasted.trim().length > 0) {
    table = parsePastedText(pasted)
    fileName = "pasted-list"
  } else {
    throw new ImportInputError("Upload a file or paste a list first", "NO_INPUT")
  }

  // Columns found: a normal spreadsheet import.
  if (table.columns.length > 0 && table.rows.length > 0) {
    return { table, mapping: detectMapping(table.columns), fileName }
  }

  // No columns but we do have text: PDF, Word, or a pasted block of prose.
  if (table.text && table.text.trim().length > 0) {
    const { leads, method, warning } = await extractLeadsWithAI(workspaceId, table.text)
    const extracted = leadsFromExtraction(leads)

    const rows = extracted.valid.map((lead) => ({
      firstName: lead.firstName,
      lastName: lead.lastName ?? "",
      email: lead.email ?? "",
      linkedinUrl: lead.linkedinUrl ?? "",
      company: lead.company ?? "",
      jobTitle: lead.jobTitle ?? "",
    }))

    const columns = ["firstName", "lastName", "email", "linkedinUrl", "company", "jobTitle"]

    return {
      table: {
        ...table,
        columns,
        rows,
        source: table.source === "PASTE" ? "AI_EXTRACT" : "AI_EXTRACT",
        warnings: [...table.warnings, ...(warning ? [warning] : [])],
      },
      mapping: detectMapping(columns),
      extraction: { ...extracted, method },
      fileName,
    }
  }

  throw new ImportInputError(
    "Nothing readable in this file. If it is a scanned PDF it needs OCR first.",
    "NO_ROWS"
  )
}

export function parseMappingField(value: FormDataEntryValue | null): ColumnMapping | null {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const parsed = JSON.parse(value) as ColumnMapping
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}
