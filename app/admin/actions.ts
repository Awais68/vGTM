// Admin password is stored in .env.local as ADMIN_PANEL_PASSWORD — never hardcode it
"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import crypto from "node:crypto"
import { prisma } from "@/lib/prisma"
import { HeyReachClient } from "@/lib/heyreach/client"
import { checkAdminAuth } from "@/lib/admin/auth"

export async function verifyAdminPassword(password: string) {
  const adminPassword = process.env.ADMIN_PANEL_PASSWORD

  if (!adminPassword) {
    return { success: false, error: "Admin panel not configured" }
  }

  const passwordBuffer = Buffer.from(password)
  const adminBuffer = Buffer.from(adminPassword)

  if (passwordBuffer.byteLength !== adminBuffer.byteLength) {
    return { success: false, error: "Invalid password" }
  }

  const match = crypto.timingSafeEqual(passwordBuffer, adminBuffer)

  if (!match) {
    return { success: false, error: "Invalid password" }
  }

  const salt = process.env.ADMIN_SESSION_SALT

  if (!salt) {
    return { success: false, error: "Admin panel not properly configured" }
  }

  const hash = crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex")

  const cookieStore = await cookies()
  cookieStore.set("admin_session", hash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8,
    path: "/",
  })

  return { success: true }
}

export async function logoutAdmin() {
  const cookieStore = await cookies()
  cookieStore.delete("admin_session")
  redirect("/admin")
}

interface AdminSettingsData {
  heyreachApiKey?: string
  aiProvider?: string
  aiApiKey?: string
  aiModel?: string
  resendApiKey?: string
}

export async function saveApiKeys(data: AdminSettingsData) {
  const isAuthed = await checkAdminAuth()

  if (!isAuthed) {
    throw new Error("Unauthorized")
  }

  if (data.heyreachApiKey) {
    const client = new HeyReachClient(data.heyreachApiKey)
    const valid = await client.verifyApiKey()

    if (!valid) {
      return {
        success: false,
        error:
          "HeyReach API key is invalid. Please check and try again.",
      }
    }
  }

  const workspace = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
  })

  if (!workspace) {
    return {
      success: false,
      error: "No workspace found. Create a workspace first.",
    }
  }

  const updateData: Record<string, string> = {}

  if (data.heyreachApiKey) updateData.heyreachApiKey = data.heyreachApiKey
  if (data.aiProvider) updateData.aiProvider = data.aiProvider
  if (data.aiApiKey) updateData.aiApiKey = data.aiApiKey
  if (data.aiModel) updateData.aiModel = data.aiModel
  if (data.resendApiKey) updateData.resendApiKey = data.resendApiKey

  if (Object.keys(updateData).length === 0) {
    return { success: true }
  }

  await prisma.workspaceSetting.upsert({
    where: { workspaceId: workspace.id },
    create: {
      workspaceId: workspace.id,
      ...updateData,
    },
    update: updateData,
  })

  return { success: true }
}
