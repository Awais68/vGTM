"use client"

import { useState } from "react"
import { login, signup } from "./actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Mode = "login" | "signup"

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [mode, setMode] = useState<Mode>("login")
  const [error, setError] = useState(initialError ?? "")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setNotice("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    try {
      if (mode === "login") {
        // A successful login redirects server-side; only the failure path returns.
        const result = await login(formData)
        if (result?.error) setError(result.error)
      } else {
        const result = await signup(formData)
        if (result?.error) setError(result.error)
        else setNotice("Account created. Check your inbox for a confirmation link, then sign in.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-xl">
            {mode === "login" ? "Sign in to vGTM" : "Create your account"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={6}
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {notice && <p className="text-sm text-green-700">{notice}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Sign up"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-gray-500 hover:text-gray-800"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login")
              setError("")
              setNotice("")
            }}
          >
            {mode === "login" ? "No account yet? Sign up" : "Already have an account? Sign in"}
          </button>
        </CardContent>
      </Card>
    </form>
  )
}
