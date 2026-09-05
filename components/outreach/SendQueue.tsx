"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  SkipForward,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"

type Channel = "LINKEDIN_CONNECTION" | "LINKEDIN_MESSAGE" | "EMAIL"
type Status = "DRAFT" | "READY" | "SENT" | "SKIPPED"

interface QueueLead {
  id: string
  firstName: string
  lastName: string | null
  company: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  email: string | null
  status: string
}

interface QueueItem {
  id: string
  channel: Channel
  stepNumber: number
  content: string
  status: Status
  edited: boolean
  sentAt: string | null
  lead: QueueLead
  campaign: { id: string; name: string } | null
}

interface Usage {
  channel: Channel
  sentToday: number
  limit: number
  remaining: number
  overLimit: boolean
}

interface CampaignOption {
  id: string
  name: string
}

const CHANNEL_LABEL: Record<Channel, string> = {
  LINKEDIN_CONNECTION: "Connection note",
  LINKEDIN_MESSAGE: "LinkedIn message",
  EMAIL: "Email",
}

const CHAR_LIMIT: Record<Channel, number> = {
  LINKEDIN_CONNECTION: 300,
  LINKEDIN_MESSAGE: 600,
  EMAIL: 2000,
}

export function SendQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [usage, setUsage] = useState<Usage[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<Status>("DRAFT")

  const [genCampaign, setGenCampaign] = useState<string>("")
  const [genChannel, setGenChannel] = useState<Channel>("LINKEDIN_CONNECTION")
  const [genStep, setGenStep] = useState("1")
  const [genCount, setGenCount] = useState("10")
  const [genTone, setGenTone] = useState("FRIENDLY_DIRECT")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/queue?status=${statusFilter}&limit=100`)
      const json = await response.json()
      if (json.success) {
        setItems(json.data.items)
        setUsage(json.data.usage)
      } else {
        toast.error(json.error ?? "Could not load the queue")
      }
    } catch {
      toast.error("Could not load the queue")
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) return
        setCampaigns(json.data)
        setGenCampaign((current) => current || json.data[0]?.id || "")
      })
      .catch(() => undefined)
  }, [])

  async function handleGenerate() {
    if (!genCampaign) {
      toast.error("Pick a campaign first")
      return
    }
    setGenerating(true)
    try {
      const response = await fetch("/api/queue/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: genCampaign,
          channel: genChannel,
          stepNumber: genChannel === "LINKEDIN_CONNECTION" ? 0 : Number(genStep),
          limit: Number(genCount),
          tone: genTone,
        }),
      })
      const json = await response.json()
      if (!json.success) {
        toast.error(json.error ?? "Generation failed")
        return
      }
      const { created, failures } = json.data
      toast.success(
        created === 0
          ? "No new drafts — every eligible lead already has one for this step"
          : `${created} draft${created === 1 ? "" : "s"} added to the queue`
      )
      if (failures?.length) toast.warning(`${failures.length} lead(s) failed to generate`)
      setStatusFilter("DRAFT")
      load()
    } catch {
      toast.error("Generation failed")
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy(item: QueueItem) {
    try {
      await navigator.clipboard.writeText(item.content)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId((id) => (id === item.id ? null : id)), 2000)
    } catch {
      toast.error("Clipboard blocked — select the text and copy manually")
    }
  }

  async function handleSaveContent(item: QueueItem, content: string) {
    if (content === item.content) return
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, content, edited: true } : i)))
    await fetch(`/api/queue/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    })
  }

  async function handleAction(item: QueueItem, action: "sent" | "skip" | "regenerate") {
    setBusyId(item.id)
    try {
      const response = await fetch(`/api/queue/${item.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "regenerate" ? { tone: genTone } : {}),
      })
      const json = await response.json()

      if (!json.success) {
        toast.error(json.error ?? "Action failed")
        return
      }

      if (action === "regenerate") {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, content: json.data.content, edited: false } : i))
        )
        return
      }

      setItems((prev) => prev.filter((i) => i.id !== item.id))
      if (action === "sent") {
        toast.success(`Logged as sent to ${item.lead.firstName}`)
        setUsage((prev) =>
          prev.map((u) =>
            u.channel === item.channel
              ? { ...u, sentToday: u.sentToday + 1, remaining: Math.max(0, u.remaining - 1) }
              : u
          )
        )
      }
    } finally {
      setBusyId(null)
    }
  }

  const blockedChannels = useMemo(
    () => new Set(usage.filter((u) => u.overLimit).map((u) => u.channel)),
    [usage]
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Send Queue</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI drafts the message, you review it, send it yourself in LinkedIn, then log it here.
          Nothing leaves this app on its own.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {usage.map((u) => (
          <div key={u.channel} className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{CHANNEL_LABEL[u.channel]} — today</span>
              <span className={`text-sm ${u.overLimit ? "text-red-600 font-medium" : "text-gray-500"}`}>
                {u.sentToday} / {u.limit}
              </span>
            </div>
            <Progress value={Math.min(100, (u.sentToday / u.limit) * 100)} className="h-2" />
            {u.overLimit && (
              <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                <ShieldAlert className="w-3 h-3" />
                Daily cap hit. Stop for today.
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="w-4 h-4 text-cyan-500" />
          Generate drafts
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={genCampaign} onValueChange={setGenCampaign}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={genChannel} onValueChange={(v) => setGenChannel(v as Channel)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LINKEDIN_CONNECTION">Connection note</SelectItem>
              <SelectItem value="LINKEDIN_MESSAGE">LinkedIn message</SelectItem>
              <SelectItem value="EMAIL">Email</SelectItem>
            </SelectContent>
          </Select>

          {genChannel !== "LINKEDIN_CONNECTION" && (
            <Select value={genStep} onValueChange={setGenStep}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Step {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={genTone} onValueChange={setGenTone}>
            <SelectTrigger className="w-44">
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

          <Input
            type="number"
            min={1}
            max={100}
            value={genCount}
            onChange={(e) => setGenCount(e.target.value)}
            className="w-24"
          />

          <Button onClick={handleGenerate} disabled={generating} className="bg-cyan-500 hover:bg-cyan-600">
            {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Generate
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {(["DRAFT", "READY", "SENT", "SKIPPED"] as Status[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            className={statusFilter === s ? "bg-cyan-500 hover:bg-cyan-600" : ""}
            onClick={() => setStatusFilter(s)}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
          Loading queue...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          Nothing here. Generate drafts above to fill the queue.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              copied={copiedId === item.id}
              blocked={blockedChannels.has(item.channel)}
              onCopy={() => handleCopy(item)}
              onSave={(content) => handleSaveContent(item, content)}
              onAction={(action) => handleAction(item, action)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function QueueCard({
  item,
  busy,
  copied,
  blocked,
  onCopy,
  onSave,
  onAction,
}: {
  item: QueueItem
  busy: boolean
  copied: boolean
  blocked: boolean
  onCopy: () => void
  onSave: (content: string) => void
  onAction: (action: "sent" | "skip" | "regenerate") => void
}) {
  const [content, setContent] = useState(item.content)

  useEffect(() => {
    setContent(item.content)
  }, [item.content])

  const limit = CHAR_LIMIT[item.channel]
  const remaining = limit - content.length
  const over = remaining < 0
  const readOnly = item.status === "SENT" || item.status === "SKIPPED"

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">
            {item.lead.firstName} {item.lead.lastName ?? ""}
            {item.lead.jobTitle ? <span className="text-gray-500"> · {item.lead.jobTitle}</span> : null}
          </p>
          <p className="text-sm text-gray-500">
            {item.lead.company ?? "—"}
            {item.campaign ? ` · ${item.campaign.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary">{CHANNEL_LABEL[item.channel]}</Badge>
          {item.stepNumber > 0 && <Badge variant="outline">Step {item.stepNumber}</Badge>}
          {item.edited && <Badge className="bg-amber-100 text-amber-700">edited</Badge>}
        </div>
      </div>

      <div className="relative">
        <Textarea
          value={content}
          readOnly={readOnly}
          onChange={(e) => setContent(e.target.value)}
          onBlur={() => !readOnly && onSave(content)}
          rows={item.channel === "LINKEDIN_CONNECTION" ? 3 : 5}
          className="pr-16 resize-none"
        />
        <Badge variant={over ? "destructive" : "secondary"} className="absolute bottom-3 right-3">
          {remaining}
        </Badge>
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={onCopy}>
            {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Copied" : "Copy text"}
          </Button>

          {item.lead.linkedinUrl && (
            <Button size="sm" variant="outline" asChild>
              <a href={item.lead.linkedinUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open profile
              </a>
            </Button>
          )}

          <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction("regenerate")}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            Regenerate
          </Button>

          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            disabled={busy || over || blocked}
            title={blocked ? "Daily cap reached for this channel" : undefined}
            onClick={() => onAction("sent")}
          >
            <Check className="w-4 h-4 mr-2" />
            I sent this
          </Button>

          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onAction("skip")}>
            <SkipForward className="w-4 h-4 mr-2" />
            Skip
          </Button>
        </div>
      )}

      {item.status === "SENT" && (
        <p className="text-xs text-gray-400">
          Sent {item.sentAt ? new Date(item.sentAt).toLocaleString() : ""}
        </p>
      )}
    </div>
  )
}
