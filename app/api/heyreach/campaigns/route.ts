import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getHeyReachClient } from "@/lib/heyreach/get-client"
import { campaignFilterSchema } from "@/lib/validators/heyreach"
import { prisma } from "@/lib/prisma"
import { HeyReachAuthError, HeyReachApiError } from "@/lib/heyreach/client"

export async function GET(request: NextRequest) {
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
      select: { workspaceId: true },
    })

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "User not found", code: "USER_NOT_FOUND" },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const parsed = campaignFilterSchema.safeParse({
      offset: searchParams.get("offset"),
      limit: searchParams.get("limit"),
    })

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          code: "INVALID_PARAMS",
        },
        { status: 400 }
      )
    }

    const client = await getHeyReachClient(dbUser.workspaceId)
    const campaigns = await client.getAllCampaigns(
      parsed.data.offset,
      parsed.data.limit
    )

    return NextResponse.json({ success: true, data: campaigns })
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
          error: "Failed to fetch campaigns from HeyReach",
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
