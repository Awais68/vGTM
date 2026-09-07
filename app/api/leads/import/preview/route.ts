import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace } from "@/lib/auth/get-current-user"
import { readImportInput, ImportInputError } from "@/lib/leads/read-request"
import { applyMapping } from "@/lib/leads/import"
import { UnsupportedFileError, SUPPORTED_EXTENSIONS } from "@/lib/leads/parsers"
import { CANONICAL_FIELDS } from "@/lib/leads/normalize"

export const maxDuration = 120

const PREVIEW_ROWS = 20

/**
 * Reads the upload, guesses the column mapping and returns a sample.
 * Nothing is written — the operator confirms the mapping and then POSTs the
 * same file to /api/leads/import.
 */
export async function POST(request: NextRequest) {
  try {
    const dbUser = await requireWorkspace()
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
    }

    const formData = await request.formData()
    const { table, mapping, extraction, fileName } = await readImportInput(formData, dbUser.workspaceId)

    const { valid, errors, duplicatesInFile } = applyMapping(table.rows, mapping)

    return NextResponse.json({
      success: true,
      data: {
        fileName,
        fileType: table.fileType,
        source: table.source,
        columns: table.columns,
        supportedFields: CANONICAL_FIELDS,
        mapping,
        totalRows: table.rows.length,
        sample: table.rows.slice(0, PREVIEW_ROWS),
        validCount: valid.length,
        duplicatesInFile,
        errors: errors.slice(0, 50),
        warnings: table.warnings,
        sheets: table.sheets ?? null,
        extraction: extraction ? { method: extraction.method, count: extraction.valid.length } : null,
      },
    })
  } catch (error) {
    if (error instanceof UnsupportedFileError) {
      return NextResponse.json(
        { success: false, error: error.message, code: "UNSUPPORTED_TYPE", data: { supported: SUPPORTED_EXTENSIONS } },
        { status: 400 }
      )
    }
    if (error instanceof ImportInputError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : "Could not read this file"
    return NextResponse.json({ success: false, error: message, code: "PARSE_ERROR" }, { status: 400 })
  }
}
