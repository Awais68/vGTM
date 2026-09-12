import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWorkspace } from "@/lib/auth/get-current-user"
import { enrollLead } from "@/lib/sequences/engine"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const dbUser = await requireWorkspace()

  if (!dbUser) {
    return NextResponse.json({ success: false, error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 })
  }

  const { id: campaignId } = await params

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, workspaceId: dbUser.workspaceId },
    include: {
      leads: true,
      sequences: { include: { steps: true } },
    },
  })

  if (!campaign) {
    return NextResponse.json({ success: false, error: "Campaign not found", code: "NOT_FOUND" }, { status: 404 })
  }

  const sequence = campaign.sequences[0]

  if (!sequence || sequence.steps.length === 0) {
    return NextResponse.json(
      { success: false, error: "Add at least one sequence step before launching", code: "NO_SEQUENCE" },
      { status: 400 }
    )
  }

  // A LinkedIn step only needs a profile URL; an email step needs an address.
  const needsEmail = sequence.steps.some((step) => step.type === "EMAIL" || step.type === "FOLLOW_UP")
  const needsLinkedIn = sequence.steps.some(
    (step) => step.type === "CONNECTION_REQUEST" || step.type === "LINKEDIN_MESSAGE"
  )

  // Never re-enroll someone who already answered — that's how people get spammed.
  const ENGAGED: string[] = ["REPLIED", "INTERESTED", "NOT_INTERESTED", "PROPOSAL_SENT"]

  const eligibleLeads = campaign.leads.filter(
    (lead) =>
      !lead.unsubscribed &&
      !ENGAGED.includes(lead.status) &&
      ((needsEmail && lead.email) || (needsLinkedIn && lead.linkedinUrl))
  )

  if (eligibleLeads.length === 0) {
    return NextResponse.json(
      { success: false, error: "No eligible leads to enroll — they need an email or LinkedIn URL, and must not have replied or unsubscribed", code: "NO_LEADS" },
      { status: 400 }
    )
  }

  // Re-launching is safe: leads already in the sequence keep their place.
  const counts = { created: 0, resumed: 0, restarted: 0, unchanged: 0 }
  for (const lead of eligibleLeads) {
    const { outcome } = await enrollLead(lead.id, sequence.id)
    counts[outcome]++
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "ACTIVE", totalCount: eligibleLeads.length },
  })

  const enrolled = counts.created + counts.resumed + counts.restarted

  return NextResponse.json({
    success: true,
    data: { campaign: updated, enrolled, alreadyEnrolled: counts.unchanged, counts },
  })
}
