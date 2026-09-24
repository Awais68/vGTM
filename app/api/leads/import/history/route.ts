import { NextResponse } from "next/server"
import { requireWorkspace } from "@/lib/auth/get-current-user"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const dbUser = await requireWorkspace()
  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const batches = await prisma.importBatch.findMany({
    where: { workspaceId: dbUser.workspaceId },
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { campaign: { select: { id: true, name: true } } },
  })

  return NextResponse.json({ success: true, data: batches })
}
