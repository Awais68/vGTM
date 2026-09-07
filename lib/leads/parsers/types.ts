import type { ImportSource } from "@prisma/client"

/** A parsed file before any column mapping is applied. */
export interface RawTable {
  /** Column headers in file order. */
  columns: string[]
  /** Rows keyed by column header. Values are already strings. */
  rows: Record<string, string>[]
  /** Extension we actually parsed as: csv, xlsx, pdf, docx, json, txt. */
  fileType: string
  source: ImportSource
  /** Non-fatal problems worth showing the operator. */
  warnings: string[]
  /** Raw text, kept for document formats so the AI extractor can re-read it. */
  text?: string
  /** Sheet names found, for spreadsheets with more than one tab. */
  sheets?: string[]
}

export const MAX_IMPORT_ROWS = 20000
