import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"

const HEADERS = [
  "firstName",
  "lastName",
  "email",
  "linkedinUrl",
  "company",
  "jobTitle",
  "phone",
  "location",
  "industry",
]

const SAMPLE = [
  ["Jane", "Doe", "jane@acme.com", "https://www.linkedin.com/in/janedoe", "Acme", "Head of Growth", "", "Berlin", "SaaS"],
  ["Omar", "Farooq", "", "https://www.linkedin.com/in/omarfarooq", "Northwind", "CTO", "", "Dubai", "Logistics"],
]

/** Downloadable starter file so operators stop guessing at column names. */
export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv"

  if (format === "csv") {
    const csv = [HEADERS.join(","), ...SAMPLE.map((row) => row.join(","))].join("\n")
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="lead-import-template.csv"',
      },
    })
  }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Leads")
  sheet.addRow(HEADERS)
  sheet.getRow(1).font = { bold: true }
  SAMPLE.forEach((row) => sheet.addRow(row))
  sheet.columns.forEach((column) => {
    column.width = 24
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="lead-import-template.xlsx"',
    },
  })
}
