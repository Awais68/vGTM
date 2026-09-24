import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Routes that authenticate themselves (or need no auth at all). They must never
 * be redirected to the login page: Vercel cron sends a bearer token, Resend
 * signs its webhooks, and an unsubscribe link is clicked from an inbox.
 */
const MACHINE_PREFIXES = ["/api/cron", "/api/webhooks", "/api/email/unsubscribe"]

/** Pages a logged-out visitor is allowed to reach. */
const PUBLIC_PREFIXES = ["/login", "/auth", "/admin"]

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (startsWithAny(pathname, MACHINE_PREFIXES)) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  // TEMPORARY (preview only): skip Supabase login gate, use backend as already
  // configured via .env (HEYREACH_API_KEY / AI_API_KEY / RESEND_API_KEY).
  // Remove NEXT_PUBLIC_BYPASS_SETUP from .env to restore normal login flow.
  // requireWorkspace() refuses this in production, so it is not a bypass there.
  if (process.env.NEXT_PUBLIC_BYPASS_SETUP === "true" && process.env.NODE_ENV !== "production") {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const isPublic = startsWithAny(pathname, PUBLIC_PREFIXES)
  let user: { id: string } | null = null

  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Treat an auth-service error as "not logged in" — the fall-through below
    // sends the visitor to the login page instead of leaking a protected view.
    user = null
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  if (!user && !isPublic) {
    // API callers get a 401 they can act on; a redirect to an HTML page just
    // breaks `fetch` on the client.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
        { status: 401 }
      )
    }

    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
