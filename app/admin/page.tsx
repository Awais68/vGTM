// Admin password is stored in .env.local as ADMIN_PANEL_PASSWORD — never hardcode it

import { redirect } from "next/navigation"
import { checkAdminAuth } from "@/lib/admin/auth"
import { AdminLoginForm } from "./AdminLoginForm"

export default async function AdminPage() {
  const isAuthed = await checkAdminAuth()

  if (isAuthed) {
    redirect("/admin/settings")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 pt-24 pb-8">
      <div className="w-full max-w-sm">
        <AdminLoginForm />
      </div>
    </div>
  )
}
