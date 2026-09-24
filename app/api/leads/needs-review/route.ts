import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/auth/get-current-user"

export async function GET() {
  const dbUser = await requireWorkspace()

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: {
      status: "NEEDS_REVIEW",
      lead: { campaign: { workspaceId: dbUser.workspaceId } },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      lead: {
        include: {
          campaign: { select: { id: true, name: true } },
          messages: {
            where: { direction: "INBOUND" },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
    },
  })

  const data = enrollments.map((enrollment) => ({
    enrollmentId: enrollment.id,
    lead: {
      id: enrollment.lead.id,
      firstName: enrollment.lead.firstName,
      lastName: enrollment.lead.lastName,
      email: enrollment.lead.email,
      company: enrollment.lead.company,
      status: enrollment.lead.status,
    },
    campaign: enrollment.lead.campaign,
    latestMessage: enrollment.lead.messages[0]?.content ?? null,
    updatedAt: enrollment.updatedAt,
  }))

  return NextResponse.json({ success: true, data })
}
