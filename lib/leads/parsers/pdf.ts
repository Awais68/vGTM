import { extractText, getDocumentProxy } from "unpdf"
import type { RawTable } from "./types"
import { tableFromPlainText } from "../text-heuristics"

/**
 * PDFs have no columns, so we extract the text and hand it on. If the page
 * looks like a printed table we recover the columns; otherwise the caller
 * falls back to extraction (AI when configured, regex when not).
 */
export async function parsePdf(buffer: ArrayBuffer, fileType = "pdf"): Promise<RawTable> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer))
  const { totalPages, text } = await extractText(pdf, { mergePages: true })

  const merged = Array.isArray(text) ? text.join("\n") : text
  const warnings: string[] = []

  if (!merged.trim()) {
    warnings.push(
      "No text found in this PDF. Scanned or image-only PDFs need OCR before they can be imported."
    )
    return { columns: [], rows: [], fileType, source: "FILE", warnings, text: "" }
  }

  warnings.push(`Read ${totalPages} page${totalPages === 1 ? "" : "s"} of text.`)

  const table = tableFromPlainText(merged)
  return {
    columns: table?.columns ?? [],
    rows: table?.rows ?? [],
    fileType,
    source: "FILE",
    warnings,
    text: merged,
  }
}
