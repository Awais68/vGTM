import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace } from "@/lib/auth/get-current-user"
import { prisma } from "@/lib/prisma"
import { applyMapping, commitImport } from "@/lib/leads/import"
import { readImportInput, parseMappingField, ImportInputError } from "@/lib/leads/read-request"
import { UnsupportedFileError, SUPPORTED_EXTENSIONS } from "@/lib/leads/parsers"
import { getHeyReachClient } from "@/lib/heyreach/get-client"
import { runTrigger } from "@/lib/automation/engine"

export const maxDuration = 300

/**
 * Commits an import. Accepts a file (csv/tsv/xlsx/json/pdf/docx/txt) or a
 * pasted list, plus the column mapping the operator confirmed in the preview.
 * Without a mapping we fall back to auto-detection, which keeps the old
 * CSV-only callers working.
 */
export async function POST(request: NextRequest) {
  try {
    const dbUser = await requireWorkspace()
    if (!dbUser) {
      return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
    }

    const formData = await request.formData()
    const campaignIdRaw = formData.get("campaignId")
    const campaignId = typeof campaignIdRaw === "string" && campaignIdRaw ? campaignIdRaw : null
    const updateExisting = formData.get("updateExisting") !== "false"
    const keepUnmappedColumns = formData.get("keepUnmappedColumns") === "true"

    if (campaignId) {
      const owned = await prisma.campaign.findFirst({
        where: { id: campaignId, workspaceId: dbUser.workspaceId },
        select: { id: true },
      })
      if (!owned) {
        return NextResponse.json(
          { success: false, error: "Campaign not found in this workspace", code: "CAMPAIGN_NOT_FOUND" },
          { status: 404 }
        )
      }
    }

    const { table, mapping: detected, fileName } = await readImportInput(formData, dbUser.workspaceId)
    const mapping = parseMappingField(formData.get("mapping")) ?? detected

    const { valid, errors, duplicatesInFile } = applyMapping(table.rows, mapping, { keepUnmappedColumns })

    if (valid.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No importable leads found — every row is missing a name, an email and a LinkedIn URL",
          code: "NO_VALID_LEADS",
          data: { errors: errors.slice(0, 50), warnings: table.warnings },
        },
        { status: 400 }
      )
    }

    const result = await commitImport({
      workspaceId: dbUser.workspaceId,
      campaignId,
      leads: valid,
      source: table.source,
      fileName,
      fileType: table.fileType,
      mapping,
      totalRows: table.rows.length,
      parseErrors: errors,
      updateExisting,
    })

    // Push to HeyReach only when the campaign is actually wired to one.
    let heyreach: { addedLeadsCount: number; updatedLeadsCount: number; failedLeadsCount: number } | null = null

    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { heyreachCampaignId: true },
      })

      if (campaign?.heyreachCampaignId) {
        const withUrls = valid.filter((l) => l.linkedinUrl)
        if (withUrls.length > 0) {
          try {
            const client = await getHeyReachClient(dbUser.workspaceId)
            heyreach = await client.addLeadsToCampaign(
              campaign.heyreachCampaignId,
              withUrls.map((l) => ({
                firstName: l.firstName,
                lastName: l.lastName ?? undefined,
                linkedinUrl: l.linkedinUrl!,
                email: l.email ?? undefined,
                company: l.company ?? undefined,
                jobTitle: l.jobTitle ?? undefined,
              }))
            )
          } catch (error) {
            result.errors.push({
              row: 0,
              message: error instanceof Error ? error.message : "Failed to push leads to HeyReach",
            })
          }
        }
      }
    }

    // Fire automation (auto-enroll, draft generation) for the new leads.
    const automation = await runTrigger({
      workspaceId: dbUser.workspaceId,
      trigger: "LEAD_IMPORTED",
      campaignId,
      context: { importBatchId: result.batchId },
    }).catch(() => null)

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        duplicatesInFile,
        fileType: table.fileType,
        warnings: table.warnings,
        heyreach,
        automation,
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
    const message = error instanceof Error ? error.message : "An unexpected error occurred"
    return NextResponse.json({ success: false, error: message, code: "INTERNAL_ERROR" }, { status: 500 })
  }
}
