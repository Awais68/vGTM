// Admin password is stored in .env.local as ADMIN_PANEL_PASSWORD — never hardcode it

import { redirect } from "next/navigation"
import { checkAdminAuth } from "@/lib/admin/auth"
import { prisma } from "@/lib/prisma"
import { AdminSettingsForm } from "./AdminSettingsForm"

export default async function AdminSettingsPage() {
  const isAuthed = await checkAdminAuth()

  if (!isAuthed) {
    redirect("/admin")
  }

  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    include: { settings: true },
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Admin Settings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage API keys and integrations for {workspace?.name ?? "your workspace"}
          </p>
        </div>
        <AdminSettingsForm
          hasHeyreachKey={!!workspace?.settings?.heyreachApiKey}
          aiProvider={workspace?.settings?.aiProvider ?? 'OPENROUTER'}
          hasAiKey={!!workspace?.settings?.aiApiKey}
          aiModel={workspace?.settings?.aiModel ?? null}
          hasResendKey={!!workspace?.settings?.resendApiKey}
        />
      </div>
    </div>
  )
}
