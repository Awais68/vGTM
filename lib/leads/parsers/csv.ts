import Papa from "papaparse"
import type { RawTable } from "./types"
import { MAX_IMPORT_ROWS } from "./types"

/**
 * Delimiter is auto-detected, so the same code path handles CSV, TSV and the
 * semicolon-separated files European Excel produces.
 */
export function parseDelimitedText(content: string, fileType = "csv"): RawTable {
  const stripped = content.replace(/^﻿/, "")

  const result = Papa.parse<Record<string, string>>(stripped, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  })

  const warnings: string[] = []
  if (result.errors.length > 0) {
    const shown = result.errors.slice(0, 5).map((e) => `row ${(e.row ?? 0) + 2}: ${e.message}`)
    warnings.push(...shown)
    if (result.errors.length > 5) warnings.push(`…and ${result.errors.length - 5} more parse warnings`)
  }

  const columns = (result.meta.fields ?? []).filter((f) => f && f.length > 0)

  const rows = result.data
    .slice(0, MAX_IMPORT_ROWS)
    .map((row) => {
      const out: Record<string, string> = {}
      for (const col of columns) out[col] = (row[col] ?? "").toString().trim()
      return out
    })
    .filter((row) => Object.values(row).some((v) => v.length > 0))

  if (result.data.length > MAX_IMPORT_ROWS) {
    warnings.push(`File has more than ${MAX_IMPORT_ROWS} rows — only the first ${MAX_IMPORT_ROWS} were read.`)
  }

  return { columns, rows, fileType, source: "FILE", warnings }
}
