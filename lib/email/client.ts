import { Resend } from "resend"
import { prisma } from "@/lib/prisma"

export async function getResendClient(
  workspaceId: string
): Promise<Resend> {
  const settings = await prisma.workspaceSetting.findUnique({
    where: { workspaceId },
    select: { resendApiKey: true },
  })

  const apiKey = settings?.resendApiKey ?? process.env.RESEND_API_KEY

  if (!apiKey) {
    throw new Error(
      "Resend API key not configured. Set it in Admin Panel."
    )
  }

  return new Resend(apiKey)
}
