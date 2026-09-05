import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace } from "@/lib/auth/get-current-user"
import { prisma } from "@/lib/prisma"
import { parseLeadsCSV, importLeadsToDB } from "@/lib/leads/import"
import { getHeyReachClient } from "@/lib/heyreach/get-client"

export async function POST(request: NextRequest) {
  try {
    const dbUser = await requireWorkspace()

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const campaignId = formData.get("campaignId") as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file uploaded", code: "NO_FILE" },
        { status: 400 }
      )
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "File exceeds 5MB limit", code: "FILE_TOO_LARGE" },
        { status: 400 }
      )
    }

    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      return NextResponse.json(
        { success: false, error: "Only CSV files are accepted", code: "INVALID_TYPE" },
        { status: 400 }
      )
    }

    const csvContent = await file.text()
    const { valid, errors: parseErrors } = parseLeadsCSV(csvContent)

    if (valid.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid leads found in CSV",
          code: "NO_VALID_LEADS",
          data: { errors: parseErrors },
        },
        { status: 400 }
      )
    }

    let importResult = { imported: 0, updated: 0, failed: 0, errors: [] as Array<{ row: number; message: string }> }

    if (campaignId) {
      importResult = await importLeadsToDB(valid, campaignId)
    }

    let heyreachResult = { addedLeadsCount: 0, updatedLeadsCount: 0, failedLeadsCount: 0 }

    if (campaignId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { heyreachCampaignId: true },
      })

      if (campaign?.heyreachCampaignId) {
        try {
          const client = await getHeyReachClient(dbUser.workspaceId)
          heyreachResult = await client.addLeadsToCampaign(
            campaign.heyreachCampaignId,
            valid.map((l) => ({
              firstName: l.firstName,
              lastName: l.lastName ?? undefined,
              linkedinUrl: l.linkedinUrl ?? "",
              email: l.email ?? undefined,
              company: l.company ?? undefined,
              jobTitle: l.jobTitle ?? undefined,
            }))
          )
        } catch {
          importResult.errors.push({
            row: 0,
            message: "Failed to push leads to HeyReach campaign",
          })
        }
      }
    }

    const allErrors = [...parseErrors, ...importResult.errors]

    return NextResponse.json({
      success: true,
      data: {
        imported: importResult.imported,
        updated: importResult.updated,
        failed: importResult.failed + parseErrors.length,
        heyreach: heyreachResult,
        errors: allErrors,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unexpected error occurred"
    return NextResponse.json(
      { success: false, error: message, code: "INTERNAL_ERROR" },
      { status: 500 }
    )
  }
}
