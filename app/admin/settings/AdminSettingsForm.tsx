// Admin password is stored in .env.local as ADMIN_PANEL_PASSWORD — never hardcode it
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { saveApiKeys, logoutAdmin } from "../actions"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface Props {
  hasHeyreachKey: boolean
  aiProvider: string
  hasAiKey: boolean
  aiModel: string | null
  hasResendKey: boolean
}

export function AdminSettingsForm({
  hasHeyreachKey,
  aiProvider: initialProvider,
  hasAiKey,
  aiModel: initialModel,
  hasResendKey,
}: Props) {
  const [heyreachKey, setHeyreachKey] = useState("")
  const [aiProvider, setAiProvider] = useState(initialProvider)
  const [aiApiKey, setAiApiKey] = useState("")
  const [aiModel, setAiModel] = useState(initialModel ?? "")
  const [resendKey, setResendKey] = useState("")
  const [testingAi, setTestingAi] = useState(false)
  const [aiTestResult, setAiTestResult] = useState<string | null>(null)
  const [testingHeyreach, setTestingHeyreach] = useState(false)
  const [heyreachStatus, setHeyreachStatus] = useState<
    "idle" | "valid" | "invalid"
  >("idle")
  const [heyreachMessage, setHeyreachMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleTestHeyreach() {
    if (!heyreachKey) {
      toast.error("Enter a HeyReach API key first")
      return
    }

    setTestingHeyreach(true)
    setHeyreachStatus("idle")
    setHeyreachMessage("")

    try {
      const response = await fetch("/api/heyreach/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: heyreachKey }),
      })

      const result = await response.json()

      if (result.success && result.data.valid) {
        setHeyreachStatus("valid")
        setHeyreachMessage("Connected successfully")
        toast.success("HeyReach connection successful")
      } else {
        setHeyreachStatus("invalid")
        setHeyreachMessage(
          result.data?.message ?? "Connection failed"
        )
        toast.error("HeyReach connection failed")
      }
    } catch {
      setHeyreachStatus("invalid")
      setHeyreachMessage("Could not reach HeyReach API")
      toast.error("Could not reach HeyReach API")
    } finally {
      setTestingHeyreach(false)
    }
  }

  async function handleTestAi() {
    if (!aiApiKey) {
      toast.error("Enter an API key first")
      return
    }

    setTestingAi(true)
    setAiTestResult(null)

    try {
      const response = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          apiKey: aiApiKey,
          model: aiModel || undefined,
        }),
      })

      const result = await response.json()

      if (result.success) {
        setAiTestResult(result.response)
        toast.success("AI connection successful")
      } else {
        toast.error(result.error ?? "AI test failed")
      }
    } catch {
      toast.error("Could not test AI connection")
    } finally {
      setTestingAi(false)
    }
  }

  async function handleSave() {
    if (!heyreachKey && !aiApiKey && !resendKey) {
      toast.error("Enter at least one API key to save")
      return
    }

    setSaving(true)

    try {
      const result = await saveApiKeys({
        heyreachApiKey: heyreachKey || undefined,
        aiProvider: aiProvider || undefined,
        aiApiKey: aiApiKey || undefined,
        aiModel: aiModel || undefined,
        resendApiKey: resendKey || undefined,
      })

      if (result.success) {
        toast.success("Settings saved successfully")
        setHeyreachKey("")
        setAiApiKey("")
        setResendKey("")
        router.refresh()
      } else {
        toast.error(result.error ?? "Failed to save settings")
      }
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    await logoutAdmin()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">LinkedIn Automation</CardTitle>
            <Badge variant={hasHeyreachKey ? "default" : "secondary"}>
              {hasHeyreachKey ? "Configured" : "Not set"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="heyreach-key">HeyReach API Key</Label>
            <Input
              id="heyreach-key"
              type="password"
              placeholder={
                hasHeyreachKey
                  ? "••••••••••••••••••••"
                  : "Enter HeyReach API key"
              }
              value={heyreachKey}
              onChange={(e) => {
                setHeyreachKey(e.target.value)
                setHeyreachStatus("idle")
              }}
            />
            <p className="text-xs text-gray-500">
              Get your key from HeyReach → Integrations → API Key
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestHeyreach}
              disabled={testingHeyreach || !heyreachKey}
            >
              {testingHeyreach ? "Testing..." : "Test Connection"}
            </Button>
            {heyreachStatus === "valid" && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                ✓ {heyreachMessage}
              </span>
            )}
            {heyreachStatus === "invalid" && (
              <span className="text-sm text-red-600 flex items-center gap-1">
                ✗ {heyreachMessage}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">AI Provider</CardTitle>
            <Badge variant={hasAiKey ? "default" : "secondary"}>
              {hasAiKey ? "Configured" : "Not set"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-provider">Provider</Label>
            <select
              id="ai-provider"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
            >
              <option value="OPENROUTER">
                OpenRouter (Recommended — access 100+ models, has free tier)
              </option>
              <option value="GEMINI">
                Google Gemini (Free tier available on AI Studio)
              </option>
              <option value="OPENAI">
                OpenAI (GPT-4o-mini is cheapest)
              </option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-api-key">API Key</Label>
            <Input
              id="ai-api-key"
              type="password"
              placeholder={
                hasAiKey
                  ? "••••••••••••••••••••"
                  : "Enter API key"
              }
              value={aiApiKey}
              onChange={(e) => {
                setAiApiKey(e.target.value)
                setAiTestResult(null)
              }}
            />
            <p className="text-xs text-gray-500">
              {aiProvider === "OPENROUTER" &&
                "Get free key at openrouter.ai — use google/gemini-flash-1.5 for free"}
              {aiProvider === "GEMINI" &&
                "Get free key at aistudio.google.com"}
              {aiProvider === "OPENAI" &&
                "Get key at platform.openai.com"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai-model">Model Name (optional)</Label>
            <Input
              id="ai-model"
              type="text"
              placeholder={
                aiProvider === "OPENROUTER"
                  ? "google/gemini-flash-1.5"
                  : aiProvider === "GEMINI"
                  ? "gemini-1.5-flash"
                  : "gpt-4o-mini"
              }
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestAi}
              disabled={testingAi || !aiApiKey}
            >
              {testingAi ? "Testing..." : "Test AI"}
            </Button>
            {aiTestResult !== null && (
              <span className="text-sm text-green-600 flex items-center gap-1">
                ✓ {aiTestResult}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Email Sending</CardTitle>
            <Badge variant={hasResendKey ? "default" : "secondary"}>
              {hasResendKey ? "Configured" : "Not set"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="resend-key">Resend API Key</Label>
          <Input
            id="resend-key"
            type="password"
            placeholder={
              hasResendKey
                ? "••••••••••••••••••••"
                : "Enter Resend API key"
            }
            value={resendKey}
            onChange={(e) => setResendKey(e.target.value)}
          />
          <p className="text-xs text-gray-500">
            Get from resend.com/api-keys
          </p>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save All Settings"}
        </Button>
        <Button
          variant="outline"
          onClick={handleLogout}
        >
          Logout Admin
        </Button>
      </div>
    </div>
  )
}
