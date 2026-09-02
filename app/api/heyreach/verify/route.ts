import { NextRequest, NextResponse } from "next/server"
import { HeyReachClient, HeyReachApiError } from "@/lib/heyreach/client"
import { verifyApiKeySchema } from "@/lib/validators/heyreach"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = verifyApiKeySchema.safeParse(body)

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

    const client = new HeyReachClient(parsed.data.apiKey)
    const valid = await client.verifyApiKey()

    if (valid) {
      return NextResponse.json({
        success: true,
        data: { valid: true, message: "API key is valid and connected to HeyReach." },
      })
    }

    return NextResponse.json({
      success: true,
      data: { valid: false, message: "API key is invalid or expired. Check your key and try again." },
    })
  } catch (error) {
    if (error instanceof HeyReachApiError) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to verify API key with HeyReach",
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
