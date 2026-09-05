"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Settings {
  senderName: string | null
  senderTitle: string | null
  defaultContext: string | null
  defaultTone: string
  dailyConnectionLimit: number
  dailyMessageLimit: number
  aiProvider: string
  aiModel: string | null
}

export function WorkspaceSettings() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((json) => setSettings(json.success ? json.data : null))
      .catch(() => setSettings(null))
      .finally(() => setLoading(false))
  }, [])

  async function save() {
    if (!settings) return
    setSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: settings.senderName,
          senderTitle: settings.senderTitle,
          defaultContext: settings.defaultContext,
          defaultTone: settings.defaultTone,
          dailyConnectionLimit: Number(settings.dailyConnectionLimit),
          dailyMessageLimit: Number(settings.dailyMessageLimit),
        }),
      })
      const json = await response.json()
      if (json.success) toast.success("Settings saved")
      else toast.error(json.error ?? "Could not save settings")
    } catch {
      toast.error("Could not save settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
        Loading settings...
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          Could not load settings.
        </div>
      </div>
    )
  }

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <section className="bg-white rounded-lg border p-4 space-y-4">
        <h2 className="font-medium">Sender identity</h2>
        <p className="text-sm text-gray-500">
          Used by the AI when it writes in your voice.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="senderName">Your name</Label>
            <Input
              id="senderName"
              value={settings.senderName ?? ""}
              onChange={(e) => update("senderName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senderTitle">Your title</Label>
            <Input
              id="senderTitle"
              value={settings.senderTitle ?? ""}
              onChange={(e) => update("senderTitle", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="defaultContext">What you offer (default context)</Label>
          <Textarea
            id="defaultContext"
            rows={4}
            placeholder="Who you help, what problem you solve, and the proof you can point to."
            value={settings.defaultContext ?? ""}
            onChange={(e) => update("defaultContext", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Default tone</Label>
          <Select value={settings.defaultTone} onValueChange={(v) => update("defaultTone", v)}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FRIENDLY_DIRECT">Friendly &amp; direct</SelectItem>
              <SelectItem value="CONSULTATIVE">Consultative</SelectItem>
              <SelectItem value="CASUAL">Casual</SelectItem>
              <SelectItem value="FORMAL">Formal</SelectItem>
              <SelectItem value="BLUNT">Blunt</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="bg-white rounded-lg border p-4 space-y-4">
        <h2 className="font-medium">Daily sending caps</h2>
        <p className="text-sm text-gray-500">
          A brake on your own volume. The app never sends anything itself — these caps stop the
          queue from letting you log more than this per day.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="connLimit">Connection notes / day</Label>
            <Input
              id="connLimit"
              type="number"
              min={1}
              max={100}
              value={settings.dailyConnectionLimit}
              onChange={(e) => update("dailyConnectionLimit", Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="msgLimit">LinkedIn messages / day</Label>
            <Input
              id="msgLimit"
              type="number"
              min={1}
              max={200}
              value={settings.dailyMessageLimit}
              onChange={(e) => update("dailyMessageLimit", Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-lg border p-4">
        <h2 className="font-medium mb-2">AI provider</h2>
        <p className="text-sm text-gray-500">
          Currently <span className="font-mono">{settings.aiProvider}</span>
          {settings.aiModel ? ` · ${settings.aiModel}` : ""}. Change the key and model in the Admin
          Panel → Settings.
        </p>
      </section>

      <Button onClick={save} disabled={saving} className="bg-cyan-500 hover:bg-cyan-600">
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save settings
      </Button>
    </div>
  )
}
