import mammoth from "mammoth"
import type { RawTable } from "./types"
import { tableFromPlainText } from "../text-heuristics"

export async function parseDocx(buffer: ArrayBuffer, fileType = "docx"): Promise<RawTable> {
  const { value, messages } = await mammoth.extractRawText({
    buffer: Buffer.from(buffer),
  })

  const warnings = messages.filter((m) => m.type === "warning").map((m) => m.message).slice(0, 5)
  const table = tableFromPlainText(value)

  return {
    columns: table?.columns ?? [],
    rows: table?.rows ?? [],
    fileType,
    source: "FILE",
    warnings,
    text: value,
  }
}
