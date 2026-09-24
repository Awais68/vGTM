"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react"

const TRIGGERS = [
  { value: "LEAD_IMPORTED", label: "A lead is imported" },
  { value: "CONNECTION_ACCEPTED", label: "A connection is accepted" },
  { value: "REPLY_RECEIVED", label: "A lead replies" },
  { value: "LEAD_STATUS_CHANGED", label: "A lead's status changes" },
  { value: "NO_REPLY_AFTER_DAYS", label: "No reply after N days" },
  { value: "QUEUE_LOW", label: "The send queue runs low" },
  { value: "SCHEDULE", label: "On the autopilot schedule" },
] as const

const ACTIONS = [
  { value: "GENERATE_DRAFTS", label: "Draft messages for review" },
  { value: "ENROLL_SEQUENCE", label: "Enroll in a sequence" },
  { value: "PUSH_TO_HEYREACH", label: "Push to HeyReach" },
  { value: "ASSIGN_SENDER", label: "Assign a sender account" },
  { value: "SET_LEAD_STATUS", label: "Set the lead status" },
  { value: "STOP_SEQUENCE", label: "Stop the sequence" },
  { value: "MARK_NEEDS_REVIEW", label: "Flag for human review" },
] as const

const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "CONNECTED",
  "REPLIED",
  "INTERESTED",
  "NOT_INTERESTED",
  "PROPOSAL_SENT",
] as const

const CHANNELS = [
  { value: "LINKEDIN_CONNECTION", label: "LinkedIn connection request" },
  { value: "LINKEDIN_MESSAGE", label: "LinkedIn message" },
  { value: "EMAIL", label: "Email" },
] as const

interface RuleAction {
  type: string
  params?: {
    sequenceId?: string
    channel?: string
    limit?: number
    status?: string
    accountId?: string
    note?: string
  }
}

interface RuleConditions {
  leadStatus?: string[]
  hasLinkedIn?: boolean
  hasEmail?: boolean
  daysSinceLastTouch?: number
  maxPendingDrafts?: number
}

interface AutomationRule {
  id: string
  name: string
  description: string | null
  trigger: string
  enabled: boolean
  priority: number
  campaignId: string | null
  campaign: { id: string; name: string } | null
  conditions: RuleConditions | null
  actions: RuleAction[]
  lastRunAt: string | null
  runCount: number
  runs: { id: string; status: string; affected: number; createdAt: string }[]
}

interface AutomationRun {
  id: string
  trigger: string
  status: string
  affected: number
  message: string | null
  durationMs: number | null
  createdAt: string
  rule: { id: string; name: string } | null
}

interface SettingsShape {
  autopilotEnabled: boolean
  autopilotQueueTarget: number
  timezone: string
}

/** Recipes that cover most of what an operator actually wants automated. */
const PRESETS: Array<{ label: string; hint: string; rule: Partial<AutomationRule> }> = [
  {
    label: "Draft a connection note for every new import",
    hint: "New leads with a LinkedIn URL get a personalised request waiting for review.",
    rule: {
      name: "Draft connection notes on import",
      trigger: "LEAD_IMPORTED",
      conditions: { hasLinkedIn: true, leadStatus: ["NEW"] },
      actions: [{ type: "GENERATE_DRAFTS", params: { channel: "LINKEDIN_CONNECTION", limit: 25 } }],
    },
  },
  {
    label: "Follow up once a connection is accepted",
    hint: "Drafts the first message the moment someone accepts.",
    rule: {
      name: "Follow up on accepted connections",
      trigger: "CONNECTION_ACCEPTED",
      conditions: {},
      actions: [{ type: "GENERATE_DRAFTS", params: { channel: "LINKEDIN_MESSAGE", limit: 25 } }],
    },
  },
  {
    label: "Nudge silent leads after 5 days",
    hint: "Contacted but quiet — drafts one more touch, nothing more.",
    rule: {
      name: "Nudge after 5 days of silence",
      trigger: "NO_REPLY_AFTER_DAYS",
      conditions: { daysSinceLastTouch: 5, leadStatus: ["CONTACTED", "CONNECTED"] },
      actions: [{ type: "GENERATE_DRAFTS", params: { channel: "LINKEDIN_MESSAGE", limit: 20 } }],
    },
  },
  {
    label: "Hand replies to a human",
    hint: "Stops the sequence and flags the lead the moment they reply.",
    rule: {
      name: "Human takeover on reply",
      trigger: "REPLY_RECEIVED",
      conditions: {},
      actions: [{ type: "STOP_SEQUENCE" }, { type: "MARK_NEEDS_REVIEW" }],
    },
  },
]

export function AutomationCenter() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [runs, setRuns] = useState<AutomationRun[]>([])
  const [settings, setSettings] = useState<SettingsShape | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AutomationRule | Partial<AutomationRule> | null>(null)

  const load = useCallback(async () => {
    try {
      const [rulesResponse, runsResponse, settingsResponse] = await Promise.all([
        fetch("/api/automation/rules"),
        fetch("/api/automation/runs?limit=30"),
        fetch("/api/settings"),
      ])
      const [rulesJson, runsJson, settingsJson] = await Promise.all([
        rulesResponse.json(),
        runsResponse.json(),
        settingsResponse.json(),
      ])

      if (rulesJson.success) setRules(rulesJson.data)
      if (runsJson.success) setRuns(runsJson.data)
      if (settingsJson.success) {
        setSettings({
          autopilotEnabled: settingsJson.data.autopilotEnabled,
          autopilotQueueTarget: settingsJson.data.autopilotQueueTarget,
          timezone: settingsJson.data.timezone,
        })
      }
      setError(null)
    } catch {
      setError("Could not load automation settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const patchSettings = async (patch: Partial<SettingsShape>) => {
    if (!settings) return
    setSettings({ ...settings, ...patch })
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })
  }

  const toggleRule = async (rule: AutomationRule) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))
    await fetch(`/api/automation/rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    })
    await load()
  }

  const deleteRule = async (rule: AutomationRule) => {
    await fetch(`/api/automation/rules/${rule.id}`, { method: "DELETE" })
    await load()
  }

  const runNow = async (body: Record<string, unknown> = {}) => {
    setRunning(true)
    setMessage(null)
    try {
      const response = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        setMessage(json.error ?? "Run failed")
        return
      }

      const data = json.data
      if (typeof data.ran === "boolean") {
        const created = (data.topUp ?? []).reduce((sum: number, t: { created: number }) => sum + t.created, 0)
        setMessage(
          data.ran
            ? `Autopilot drafted ${created} message(s) across ${data.topUp?.length ?? 0} campaign/channel pair(s).`
            : (data.reason ?? "Autopilot is off")
        )
      } else {
        setMessage(`Ran ${data.rulesRun ?? 0} rule(s), touched ${data.affected ?? 0} lead(s).`)
      }
      await load()
    } catch {
      setMessage("Network error during the run")
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading automation…
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Automation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Rules that do the work before the send: drafting, sequencing and sender assignment.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => runNow()} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run autopilot now
          </Button>
          <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={() => setEditing({})}>
            <Plus className="mr-2 h-4 w-4" />
            New rule
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 h-5 w-5 text-cyan-600" />
            <div>
              <p className="font-medium">Autopilot</p>
              <p className="max-w-2xl text-sm text-gray-500">
                Runs on a schedule and keeps every active campaign&apos;s queue topped up, bounded by each
                sender&apos;s real daily headroom and working hours. It never sends a LinkedIn message —
                a human still presses send.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <Label className="text-xs text-gray-500">Queue target</Label>
              <Input
                type="number"
                min={1}
                max={200}
                className="w-24"
                value={settings?.autopilotQueueTarget ?? 25}
                onChange={(e) => patchSettings({ autopilotQueueTarget: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Timezone</Label>
              <Input
                className="w-40"
                value={settings?.timezone ?? "UTC"}
                onChange={(e) => setSettings(settings ? { ...settings, timezone: e.target.value } : settings)}
                onBlur={(e) => patchSettings({ timezone: e.target.value })}
              />
            </div>
            <Switch
              checked={settings?.autopilotEnabled ?? false}
              onCheckedChange={(checked) => patchSettings({ autopilotEnabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {message && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">{message}</div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="history">Run history</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4 pt-4">
          {rules.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Start from a recipe</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setEditing(preset.rule)}
                    className="rounded-lg border p-3 text-left transition-colors hover:border-cyan-400 hover:bg-cyan-50"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Zap className="h-3.5 w-3.5 text-cyan-600" />
                      {preset.label}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{preset.hint}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {rules.map((rule) => (
            <Card key={rule.id} className={rule.enabled ? "" : "opacity-60"}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{rule.name}</p>
                    <Badge variant="outline">
                      {TRIGGERS.find((t) => t.value === rule.trigger)?.label ?? rule.trigger}
                    </Badge>
                    {rule.campaign && <Badge variant="outline">{rule.campaign.name}</Badge>}
                  </div>
                  {rule.description && <p className="mt-1 text-sm text-gray-500">{rule.description}</p>}
                  <p className="mt-2 text-sm text-gray-600">
                    →{" "}
                    {rule.actions
                      .map((action) => ACTIONS.find((a) => a.value === action.type)?.label ?? action.type)
                      .join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Ran {rule.runCount} time(s)
                    {rule.lastRunAt ? ` · last ${new Date(rule.lastRunAt).toLocaleString()}` : ""}
                    {rule.runs[0] ? ` · ${rule.runs[0].affected} lead(s) last run` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule)} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runNow({ trigger: rule.trigger, campaignId: rule.campaignId })}
                    disabled={running}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(rule)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => deleteRule(rule)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {rules.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setEditing(preset.rule)}
                  className="rounded-lg border border-dashed p-3 text-left text-sm transition-colors hover:border-cyan-400 hover:bg-cyan-50"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Plus className="h-3.5 w-3.5" />
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-2 pt-4">
          {runs.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Nothing has run yet.</p>
          ) : (
            runs.map((run) => (
              <div key={run.id} className="flex items-start gap-3 rounded-lg border bg-white p-3 text-sm">
                {run.status === "SUCCESS" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                ) : run.status === "PARTIAL" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{run.rule?.name ?? "Autopilot"}</p>
                  <p className="text-gray-500">
                    {run.message ?? `${run.affected} lead(s) affected`}
                  </p>
                </div>
                <span className="whitespace-nowrap text-xs text-gray-400">
                  {new Date(run.createdAt).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {editing && (
        <RuleDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}

function RuleDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: AutomationRule | Partial<AutomationRule>
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isEdit = typeof (initial as AutomationRule).id === "string"
  const [name, setName] = useState(initial.name ?? "")
  const [description, setDescription] = useState(initial.description ?? "")
  const [trigger, setTrigger] = useState(initial.trigger ?? "LEAD_IMPORTED")
  const [campaignId, setCampaignId] = useState(initial.campaignId ?? "")
  const [conditions, setConditions] = useState<RuleConditions>(initial.conditions ?? {})
  const [actions, setActions] = useState<RuleAction[]>(
    initial.actions?.length ? initial.actions : [{ type: "GENERATE_DRAFTS", params: { channel: "LINKEDIN_MESSAGE", limit: 25 } }]
  )
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([])
  const [sequences, setSequences] = useState<{ id: string; name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const [campaignsResponse, sequencesResponse] = await Promise.all([
        fetch("/api/campaigns").catch(() => null),
        fetch("/api/sequences").catch(() => null),
      ])
      if (campaignsResponse?.ok) {
        const json = await campaignsResponse.json()
        const data = json.data ?? json
        if (Array.isArray(data)) setCampaigns(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })))
      }
      if (sequencesResponse?.ok) {
        const json = await sequencesResponse.json()
        const data = json.data ?? json
        if (Array.isArray(data)) setSequences(data.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })))
      }
    })()
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name,
        description: description.trim() || null,
        trigger,
        campaignId: campaignId || null,
        conditions,
        actions,
      }
      const url = isEdit ? `/api/automation/rules/${(initial as AutomationRule).id}` : "/api/automation/rules"
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        setError(json.error ?? "Could not save the rule")
        return
      }
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  const updateAction = (index: number, patch: Partial<RuleAction>) => {
    setActions((prev) => prev.map((action, i) => (i === index ? { ...action, ...patch } : action)))
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit rule" : "New automation rule"}</DialogTitle>
          <DialogDescription>When the trigger fires and the conditions match, run the actions.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Draft notes for new imports" />
          </div>

          <div>
            <Label>Description (optional)</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Trigger</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campaign</Label>
              <Select value={campaignId || "__all__"} onValueChange={(v) => setCampaignId(v === "__all__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All campaigns</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <Label className="mb-2 block">Only for leads that…</Label>

            <div className="mb-3 flex flex-wrap gap-3">
              {LEAD_STATUSES.map((status) => (
                <label key={status} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={conditions.leadStatus?.includes(status) ?? false}
                    onCheckedChange={(checked) => {
                      const current = conditions.leadStatus ?? []
                      const next = checked === true ? [...current, status] : current.filter((s) => s !== status)
                      setConditions({ ...conditions, leadStatus: next.length ? next : undefined })
                    }}
                  />
                  {status.replace("_", " ").toLowerCase()}
                </label>
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={conditions.hasLinkedIn ?? false}
                  onCheckedChange={(checked) =>
                    setConditions({ ...conditions, hasLinkedIn: checked === true ? true : undefined })
                  }
                />
                have a LinkedIn URL
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={conditions.hasEmail ?? false}
                  onCheckedChange={(checked) =>
                    setConditions({ ...conditions, hasEmail: checked === true ? true : undefined })
                  }
                />
                have an email
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Untouched for at least (days)</Label>
                <Input
                  type="number"
                  min={0}
                  value={conditions.daysSinceLastTouch ?? ""}
                  onChange={(e) =>
                    setConditions({
                      ...conditions,
                      daysSinceLastTouch: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Skip while queue already holds</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="drafts"
                  value={conditions.maxPendingDrafts ?? ""}
                  onChange={(e) =>
                    setConditions({
                      ...conditions,
                      maxPendingDrafts: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label>Then do</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setActions([...actions, { type: "MARK_NEEDS_REVIEW" }])}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add action
              </Button>
            </div>

            <div className="space-y-3">
              {actions.map((action, index) => (
                <div key={index} className="space-y-2 rounded border p-2">
                  <div className="flex items-center gap-2">
                    <Select value={action.type} onValueChange={(value) => updateAction(index, { type: value })}>
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {actions.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => setActions(actions.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {action.type === "GENERATE_DRAFTS" && (
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={action.params?.channel ?? "LINKEDIN_MESSAGE"}
                        onValueChange={(value) =>
                          updateAction(index, { params: { ...action.params, channel: value } })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHANNELS.map((channel) => (
                            <SelectItem key={channel.value} value={channel.value}>
                              {channel.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        placeholder="Max drafts"
                        value={action.params?.limit ?? 25}
                        onChange={(e) =>
                          updateAction(index, { params: { ...action.params, limit: Number(e.target.value) } })
                        }
                      />
                    </div>
                  )}

                  {action.type === "ENROLL_SEQUENCE" && (
                    <Select
                      value={action.params?.sequenceId ?? ""}
                      onValueChange={(value) =>
                        updateAction(index, { params: { ...action.params, sequenceId: value } })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a sequence" />
                      </SelectTrigger>
                      <SelectContent>
                        {sequences.map((sequence) => (
                          <SelectItem key={sequence.id} value={sequence.id}>
                            {sequence.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {action.type === "SET_LEAD_STATUS" && (
                    <Select
                      value={action.params?.status ?? "CONTACTED"}
                      onValueChange={(value) => updateAction(index, { params: { ...action.params, status: value } })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.replace("_", " ").toLowerCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!name.trim() || saving} className="bg-cyan-500 hover:bg-cyan-600">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save rule" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
