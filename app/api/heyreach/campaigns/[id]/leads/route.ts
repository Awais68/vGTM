import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { getHeyReachClient } from "@/lib/heyreach/get-client"
import { addLeadsSchema } from "@/lib/validators/heyreach"
import { HeyReachAuthError, HeyReachApiError } from "@/lib/heyreach/client"
import type { HeyReachLead } from "@/lib/heyreach/types"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: { id: true, workspaceId: true },
    })

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "USER_NOT_FOUND" },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { id: campaignIdParam } = await params
    const campaignId = Number(campaignIdParam)

    if (isNaN(campaignId) || campaignId <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid campaign ID",
          code: "INVALID_CAMPAIGN_ID",
        },
        { status: 400 }
      )
    }

    const parsed = addLeadsSchema.safeParse({
      campaignId,
      leads: body.leads,
    })

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? "Invalid request body",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      )
    }

    const client = await getHeyReachClient(dbUser.workspaceId)
    const result = await client.addLeadsToCampaign(campaignId, parsed.data.leads)

    const leadsToSave: Array<{
      firstName: string
      lastName: string | null
      email: string | null
      linkedinUrl: string | null
      company: string | null
      jobTitle: string | null
      campaignId: string
    }> = []

    for (const lead of parsed.data.leads) {
      const existingCampaign = await prisma.campaign.findFirst({
        where: { heyreachCampaignId: campaignId },
      })

      if (existingCampaign) {
        leadsToSave.push({
          firstName: lead.firstName,
          lastName: lead.lastName ?? null,
          email: lead.email ?? null,
          linkedinUrl: lead.linkedinUrl,
          company: lead.company ?? null,
          jobTitle: lead.jobTitle ?? null,
          campaignId: existingCampaign.id,
        })
      }
    }

    if (leadsToSave.length > 0) {
      await prisma.lead.createMany({
        data: leadsToSave,
        skipDuplicates: true,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        addedLeadsCount: result.addedLeadsCount,
        updatedLeadsCount: result.updatedLeadsCount,
        failedLeadsCount: result.failedLeadsCount,
      },
    })
  } catch (error) {
    if (error instanceof HeyReachAuthError) {
      return NextResponse.json(
        {
          success: false,
          error: "HeyReach API key is invalid or expired. Configure it in Admin Panel.",
          code: "HEYREACH_AUTH_ERROR",
        },
        { status: 401 }
      )
    }

    if (error instanceof HeyReachApiError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to add leads to campaign in HeyReach",
          code: "HEYREACH_API_ERROR",
        },
        { status: 502 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    )
  }
}
