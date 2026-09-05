import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

export interface WorkspaceContext {
  id: string
  workspaceId: string
}

export async function getCurrentDbUser(): Promise<WorkspaceContext | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    select: { id: true, workspaceId: true },
  })

  return dbUser
}

/**
 * Resolves the workspace for an API request.
 *
 * Normally this is the logged-in Supabase user. When NEXT_PUBLIC_BYPASS_SETUP
 * is on (the local/preview mode the middleware already honours) we fall back to
 * a single local workspace so the whole app is usable without auth wiring.
 * The fallback is deliberately refused in production.
 */
export async function requireWorkspace(): Promise<WorkspaceContext | null> {
  const user = await getCurrentDbUser()
  if (user) return user

  const bypass = process.env.NEXT_PUBLIC_BYPASS_SETUP === "true"
  if (!bypass || process.env.NODE_ENV === "production") return null

  const existing = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, workspaceId: true },
  })
  if (existing) return existing

  const workspace = await prisma.workspace.create({
    data: {
      name: "Local Workspace",
      users: { create: { email: "local@vgtm.dev", name: "Local Operator" } },
      settings: { create: {} },
    },
    include: { users: { select: { id: true } } },
  })

  return { id: workspace.users[0].id, workspaceId: workspace.id }
}

export function unauthorized() {
  return Response.json(
    { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
    { status: 401 }
  )
}
