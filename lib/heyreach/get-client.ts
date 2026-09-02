import { prisma } from "@/lib/prisma"
import { HeyReachClient } from "./client"

export async function getHeyReachClient(
  workspaceId: string
): Promise<HeyReachClient> {
  const settings = await prisma.workspaceSetting.findUnique({
    where: { workspaceId },
    select: { heyreachApiKey: true },
  })

  const apiKey = settings?.heyreachApiKey ?? process.env.HEYREACH_API_KEY

  if (!apiKey) {
    throw new Error(
      "HeyReach API key not configured. Set it in Admin Panel."
    )
  }

  return new HeyReachClient(apiKey)
}
