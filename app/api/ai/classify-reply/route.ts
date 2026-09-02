import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { classifyReply } from "@/lib/ai/personalization"

export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { messageContent, leadId } = body as {
      messageContent: string
      leadId: string
    }

    if (!messageContent || !leadId) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: messageContent, leadId",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      )
    }

    const result = await classifyReply(dbUser.workspaceId, messageContent)

    const statusMap: Record<string, string> = {
      INTERESTED: "INTERESTED",
      NOT_INTERESTED: "NOT_INTERESTED",
      QUESTION: "REPLIED",
      OUT_OF_OFFICE: "CONTACTED",
      OTHER: "REPLIED",
    }

    const newStatus = statusMap[result.intent] ?? "REPLIED"

    await prisma.lead.update({
      where: { id: leadId },
      data: { status: newStatus as never },
    })

    if (result.intent === "INTERESTED") {
      console.log(
        `[NOTIFICATION] Lead ${leadId} is interested. Suggested action: ${result.suggestedAction}`
      )
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred"

    return NextResponse.json(
      { success: false, error: message, code: "AI_ERROR" },
      { status: 500 }
    )
  }
}
