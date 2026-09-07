import ExcelJS from "exceljs"
import type { RawTable } from "./types"
import { MAX_IMPORT_ROWS } from "./types"

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "object") {
    // Hyperlinks and rich text are the two shapes that matter for lead lists:
    // a LinkedIn column is very often a hyperlink, not plain text.
    if ("text" in value && typeof value.text === "string") return value.text.trim()
    if ("hyperlink" in value && typeof value.hyperlink === "string") return value.hyperlink.trim()
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((r) => r.text).join("").trim()
    }
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue)
  }
  return String(value).trim()
}

/** Reads the first sheet that actually has a header row plus data. */
export async function parseExcel(buffer: ArrayBuffer, fileType = "xlsx"): Promise<RawTable> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const warnings: string[] = []
  const sheets = workbook.worksheets.map((w) => w.name)

  const sheet = workbook.worksheets.find((w) => w.rowCount > 1) ?? workbook.worksheets[0]
  if (!sheet) {
    return { columns: [], rows: [], fileType, source: "FILE", warnings: ["Workbook has no sheets"], sheets }
  }
  if (sheets.length > 1) {
    warnings.push(`Workbook has ${sheets.length} sheets — imported "${sheet.name}" only.`)
  }

  // The header is the first row with at least two non-empty cells; exports
  // often start with a title row we need to skip.
  let headerRowNumber = 1
  for (let r = 1; r <= Math.min(sheet.rowCount, 10); r++) {
    const values = (sheet.getRow(r).values as ExcelJS.CellValue[]).slice(1).map(cellToString)
    if (values.filter((v) => v.length > 0).length >= 2) {
      headerRowNumber = r
      break
    }
  }

  const headerValues = (sheet.getRow(headerRowNumber).values as ExcelJS.CellValue[]).slice(1)
  const columns: string[] = []
  const columnIndexes: number[] = []

  headerValues.forEach((value, i) => {
    const name = cellToString(value)
    if (!name) return
    // Duplicate headers would silently overwrite each other.
    const unique = columns.includes(name) ? `${name} (${i + 1})` : name
    columns.push(unique)
    columnIndexes.push(i + 1)
  })

  const rows: Record<string, string>[] = []
  for (let r = headerRowNumber + 1; r <= sheet.rowCount && rows.length < MAX_IMPORT_ROWS; r++) {
    const row = sheet.getRow(r)
    const out: Record<string, string> = {}
    let hasValue = false
    columns.forEach((col, i) => {
      const text = cellToString(row.getCell(columnIndexes[i]).value)
      out[col] = text
      if (text) hasValue = true
    })
    if (hasValue) rows.push(out)
  }

  if (sheet.rowCount - headerRowNumber > MAX_IMPORT_ROWS) {
    warnings.push(`Sheet has more than ${MAX_IMPORT_ROWS} rows — only the first ${MAX_IMPORT_ROWS} were read.`)
  }

  return { columns, rows, fileType, source: "FILE", warnings, sheets }
}
