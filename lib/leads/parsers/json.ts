import type { RawTable } from "./types"
import { MAX_IMPORT_ROWS } from "./types"

/** Accepts an array of objects, or an object wrapping one under a common key. */
export function parseJson(content: string, fileType = "json"): RawTable {
  const warnings: string[] = []
  let parsed: unknown

  try {
    parsed = JSON.parse(content)
  } catch {
    // JSON Lines is common in scraper exports.
    const lines = content.trim().split("\n")
    const items: unknown[] = []
    for (const line of lines) {
      try {
        items.push(JSON.parse(line))
      } catch {
        /* ignore the line */
      }
    }
    if (items.length === 0) throw new Error("File is not valid JSON or JSON Lines")
    warnings.push("Parsed as JSON Lines (one object per line).")
    parsed = items
  }

  let records: Record<string, unknown>[]

  if (Array.isArray(parsed)) {
    records = parsed as Record<string, unknown>[]
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>
    const arrayKey = ["leads", "data", "results", "items", "records", "rows"].find((k) =>
      Array.isArray(obj[k])
    )
    if (!arrayKey) throw new Error("JSON must be an array of leads, or contain one under leads/data/results")
    records = obj[arrayKey] as Record<string, unknown>[]
  } else {
    throw new Error("JSON must be an array of lead objects")
  }

  const columns: string[] = []
  const rows: Record<string, string>[] = []

  for (const record of records.slice(0, MAX_IMPORT_ROWS)) {
    if (!record || typeof record !== "object") continue
    const flat = flatten(record)
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(flat)) {
      if (!columns.includes(key)) columns.push(key)
      out[key] = value
    }
    rows.push(out)
  }

  return { columns, rows, fileType, source: "FILE", warnings }
}

/** One level of nesting is enough for the shapes scrapers actually emit. */
function flatten(record: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(record)) {
    const name = prefix ? `${prefix}.${key}` : key
    if (value === null || value === undefined) {
      out[name] = ""
    } else if (Array.isArray(value)) {
      out[name] = value.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ")
    } else if (typeof value === "object" && !prefix) {
      Object.assign(out, flatten(value as Record<string, unknown>, name))
    } else if (typeof value === "object") {
      out[name] = JSON.stringify(value)
    } else {
      out[name] = String(value)
    }
  }
  return out
}
