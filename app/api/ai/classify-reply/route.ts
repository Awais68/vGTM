import { NextRequest, NextResponse } from "next/server"
import { requireWorkspace } from "@/lib/auth/get-current-user"
import { prisma } from "@/lib/prisma"
import { classifyReply } from "@/lib/ai/personalization"

export async function POST(request: NextRequest) {
  try {
    const dbUser = await requireWorkspace()

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
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
