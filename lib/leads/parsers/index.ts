import type { RawTable } from "./types"
import { parseDelimitedText } from "./csv"
import { parseExcel } from "./excel"
import { parsePdf } from "./pdf"
import { parseDocx } from "./docx"
import { parseJson } from "./json"
import { tableFromPlainText } from "../text-heuristics"

export * from "./types"

export const SUPPORTED_EXTENSIONS = [
  "csv",
  "tsv",
  "txt",
  "xlsx",
  "xls",
  "xlsm",
  "json",
  "jsonl",
  "ndjson",
  "pdf",
  "docx",
] as const

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export function detectFileType(fileName: string, mimeType?: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? ""
  if ((SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) return ext

  const mime = (mimeType ?? "").toLowerCase()
  if (mime.includes("spreadsheet") || mime.includes("excel")) return "xlsx"
  if (mime.includes("pdf")) return "pdf"
  if (mime.includes("wordprocessing")) return "docx"
  if (mime.includes("json")) return "json"
  if (mime.includes("csv")) return "csv"
  if (mime.startsWith("text/")) return "txt"
  return ext || "unknown"
}

export class UnsupportedFileError extends Error {
  constructor(fileType: string) {
    super(
      `Cannot read ".${fileType}" files. Supported: ${SUPPORTED_EXTENSIONS.join(", ")}. ` +
        `Old .xls files must be re-saved as .xlsx.`
    )
    this.name = "UnsupportedFileError"
  }
}

/**
 * Single entry point for every upload. Spreadsheet-shaped formats come back
 * with real columns; document formats come back with `text` set and no rows,
 * which tells the caller to run extraction over the text instead.
 */
export async function parseUpload(file: File): Promise<RawTable> {
  const fileType = detectFileType(file.name, file.type)

  switch (fileType) {
    case "csv":
    case "tsv":
      return parseDelimitedText(await file.text(), fileType)

    case "json":
    case "jsonl":
    case "ndjson":
      return parseJson(await file.text(), fileType)

    case "xlsx":
    case "xlsm":
      return parseExcel(await file.arrayBuffer(), fileType)

    case "xls":
      // ExcelJS reads the modern OOXML format only; the legacy BIFF format
      // needs re-saving. Say so plainly instead of failing deep in the parser.
      throw new UnsupportedFileError("xls")

    case "pdf":
      return parsePdf(await file.arrayBuffer(), fileType)

    case "docx":
      return parseDocx(await file.arrayBuffer(), fileType)

    case "txt":
      return parsePastedText(await file.text(), "txt")

    default:
      throw new UnsupportedFileError(fileType)
  }
}

/** Pasted content: try to read it as a table, otherwise treat it as prose. */
export function parsePastedText(content: string, fileType = "txt"): RawTable {
  const looksDelimited = /[\t,;|]/.test(content.split("\n")[0] ?? "")

  if (looksDelimited) {
    const table = parseDelimitedText(content, fileType)
    if (table.columns.length >= 2 && table.rows.length > 0) {
      return { ...table, source: "PASTE", text: content }
    }
  }

  const table = tableFromPlainText(content)
  return {
    columns: table?.columns ?? [],
    rows: table?.rows ?? [],
    fileType,
    source: "PASTE",
    warnings: [],
    text: content,
  }
}
