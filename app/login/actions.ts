"use server"

import { getAppUrl } from "@/lib/app-url"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { createClient } from "@/lib/supabase/server"

export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath("/")
  redirect("/")
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  }

  // The confirmation link must land on /auth/callback so the code can be
  // exchanged for a session; the Supabase default is the bare site URL.
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim()
    ? getAppUrl()
    : (await headers()).get("origin") ?? "http://localhost:3000"

  const { error } = await supabase.auth.signUp({
    ...data,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}
