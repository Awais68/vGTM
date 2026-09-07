"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Linkedin,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react"
import { useSenderAccounts, type SenderAccount } from "@/components/linkedin/sender-context"

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface WorkingHourSlot {
  day: number
  enabled: boolean
  startHour: number
  endHour: number
}

const DEFAULT_HOURS: WorkingHourSlot[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  enabled: day >= 1 && day <= 5,
  startHour: 9,
  endHour: 17,
}))

function readWorkingHours(value: unknown): WorkingHourSlot[] {
  if (!Array.isArray(value) || value.length !== 7) return DEFAULT_HOURS
  return value as WorkingHourSlot[]
}

const STATUS_STYLES: Record<SenderAccount["status"], string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-amber-100 text-amber-800",
  DISCONNECTED: "bg-gray-100 text-gray-700",
  NEEDS_ATTENTION: "bg-red-100 text-red-800",
}

const PLAN_LABELS: Record<SenderAccount["subscription"], string> = {
  FREE: "Free",
  PREMIUM: "Premium",
  SALES_NAVIGATOR: "Sales Navigator",
  RECRUITER: "Recruiter",
}

export function LinkedInAccounts() {
  const { accounts, activeAccountId, setActiveAccountId, loading, error, refresh } = useSenderAccounts()
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<SenderAccount | null>(null)

  const syncFromHeyReach = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const response = await fetch("/api/linkedin-accounts/sync", { method: "POST" })
      const json = await response.json()
      if (!response.ok || !json.success) {
        setSyncMessage(json.error ?? "Sync failed")
        return
      }
      setSyncMessage(
        `Synced ${json.data.total} HeyReach sender(s): ${json.data.created} added, ${json.data.updated} updated.`
      )
      await refresh()
    } catch {
      setSyncMessage("Network error during sync")
    } finally {
      setSyncing(false)
    }
  }

  const makeDefault = async (account: SenderAccount) => {
    await fetch(`/api/linkedin-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    })
    await refresh()
  }

  const toggleStatus = async (account: SenderAccount) => {
    await fetch(`/api/linkedin-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: account.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }),
    })
    await refresh()
  }

  const removeAccount = async (account: SenderAccount) => {
    await fetch(`/api/linkedin-accounts/${account.id}`, { method: "DELETE" })
    if (activeAccountId === account.id) setActiveAccountId(null)
    await refresh()
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">LinkedIn accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Sender identities used to rotate outreach. Switch the active sender from the header.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={syncFromHeyReach} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Sync from HeyReach
          </Button>
          <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add sender
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
        <div>
          <p className="font-medium">No LinkedIn passwords are stored here.</p>
          <p className="mt-1 text-blue-800">
            Handing LinkedIn credentials to a third-party tool violates their terms and is the fastest
            route to a permanent ban. These records are sender identities only: limits, schedules and
            warm-up. Messages are either sent by you from LinkedIn itself, or by HeyReach under its own
            connection.
          </p>
        </div>
      </div>

      {syncMessage && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">{syncMessage}</div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-8 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading accounts…
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Linkedin className="mx-auto mb-4 h-10 w-10 text-gray-300" />
            <p className="font-medium">No sender accounts yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
              Add the profile you send from, or pull the profiles already connected to HeyReach.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {accounts.map((account) => (
            <Card key={account.id} className={account.id === activeAccountId ? "border-cyan-400 shadow-sm" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {account.avatarUrl ? <AvatarImage src={account.avatarUrl} alt={account.name} /> : null}
                      <AvatarFallback className="bg-cyan-100 text-cyan-700">
                        {account.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 truncate text-base">
                        {account.name}
                        {account.isDefault && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
                      </CardTitle>
                      <p className="truncate text-xs text-gray-500">{account.email ?? account.profileUrl ?? "—"}</p>
                    </div>
                  </div>
                  <Badge className={STATUS_STYLES[account.status]}>{account.status.replace("_", " ")}</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{PLAN_LABELS[account.subscription]}</Badge>
                  <Badge variant="outline">{account.provider === "HEYREACH" ? "HeyReach" : "Manual"}</Badge>
                  <Badge variant="outline">{account.campaignCount} campaign(s)</Badge>
                  <Badge variant="outline" className={account.withinWorkingHours ? "text-green-700" : "text-gray-500"}>
                    <Clock className="mr-1 h-3 w-3" />
                    {account.withinWorkingHours ? "In hours" : "Outside hours"}
                  </Badge>
                </div>

                <UsageBar
                  label="Connections today"
                  usage={account.usage.connection}
                />
                <UsageBar label="Messages today" usage={account.usage.message} />

                {account.warmupEnabled && account.warmupProgress < 100 && (
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-gray-500">
                      <span>Warm-up ramp</span>
                      <span>{account.warmupProgress}% of full limits</span>
                    </div>
                    <Progress value={account.warmupProgress} className="h-1.5" />
                  </div>
                )}

                {account.lastError && (
                  <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{account.lastError}</p>
                )}

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <Button
                    size="sm"
                    variant={account.id === activeAccountId ? "default" : "outline"}
                    className={account.id === activeAccountId ? "bg-cyan-500 hover:bg-cyan-600" : ""}
                    onClick={() => setActiveAccountId(account.id)}
                  >
                    {account.id === activeAccountId ? (
                      <>
                        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                        Active sender
                      </>
                    ) : (
                      "Switch to this"
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditing(account)}>
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    Limits &amp; hours
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toggleStatus(account)}>
                    {account.status === "ACTIVE" ? "Pause" : "Resume"}
                  </Button>
                  {!account.isDefault && (
                    <Button size="sm" variant="outline" onClick={() => makeDefault(account)}>
                      Make default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => removeAccount(account)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddSenderDialog open={addOpen} onOpenChange={setAddOpen} onCreated={refresh} />
      <EditSenderDialog account={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </div>
  )
}

function UsageBar({ label, usage }: { label: string; usage: { sentToday: number; limit: number; pending: number } }) {
  const percent = usage.limit > 0 ? Math.min(100, Math.round((usage.sentToday / usage.limit) * 100)) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-500">
          {usage.sentToday}/{usage.limit}
          {usage.pending > 0 ? ` · ${usage.pending} queued` : ""}
        </span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  )
}

function AddSenderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void>
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [profileUrl, setProfileUrl] = useState("")
  const [subscription, setSubscription] = useState<SenderAccount["subscription"]>("FREE")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/linkedin-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: email.trim() || null,
          profileUrl: profileUrl.trim() || null,
          subscription,
        }),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        setError(json.error ?? "Could not add this sender")
        return
      }
      setName("")
      setEmail("")
      setProfileUrl("")
      await onCreated()
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a sender</DialogTitle>
          <DialogDescription>
            Identify the LinkedIn profile you send from. No password is asked for and none is stored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="sender-name">Name</Label>
            <Input id="sender-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ayesha Khan" />
          </div>
          <div>
            <Label htmlFor="sender-email">Email (optional)</Label>
            <Input
              id="sender-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ayesha@company.com"
            />
          </div>
          <div>
            <Label htmlFor="sender-profile">LinkedIn profile URL (optional)</Label>
            <Input
              id="sender-profile"
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/ayesha"
            />
          </div>
          <div>
            <Label>Plan</Label>
            <Select value={subscription} onValueChange={(v) => setSubscription(v as SenderAccount["subscription"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLAN_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || saving} className="bg-cyan-500 hover:bg-cyan-600">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add sender
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditSenderDialog({
  account,
  onClose,
  onSaved,
}: {
  account: SenderAccount | null
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [form, setForm] = useState<{
    dailyConnectionLimit: number
    dailyMessageLimit: number
    warmupEnabled: boolean
    warmupDays: number
    timezone: string
    workingHours: WorkingHourSlot[]
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the account into local state the first time this dialog sees it.
  const current = account
  if (current && !form) {
    setForm({
      dailyConnectionLimit: current.dailyConnectionLimit,
      dailyMessageLimit: current.dailyMessageLimit,
      warmupEnabled: current.warmupEnabled,
      warmupDays: current.warmupDays,
      timezone: current.timezone,
      workingHours: readWorkingHours(current.workingHours),
    })
  }

  const close = () => {
    setForm(null)
    setError(null)
    onClose()
  }

  const save = async () => {
    if (!current || !form) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/linkedin-accounts/${current.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await response.json()
      if (!response.ok || !json.success) {
        setError(json.error ?? "Could not save")
        return
      }
      await onSaved()
      close()
    } finally {
      setSaving(false)
    }
  }

  if (!current || !form) return null

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{current.name} — limits &amp; hours</DialogTitle>
          <DialogDescription>
            Daily caps are enforced per sender, so one profile can never eat another&apos;s headroom.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Connections / day</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.dailyConnectionLimit}
                onChange={(e) => setForm({ ...form, dailyConnectionLimit: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Messages / day</Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={form.dailyMessageLimit}
                onChange={(e) => setForm({ ...form, dailyMessageLimit: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            LinkedIn tolerates roughly 20 connection requests a day on a free account. Going higher is
            what gets profiles restricted — raise these only for an aged, warmed-up account.
          </p>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Warm-up ramp</p>
              <p className="text-xs text-gray-500">Start at 30% of the limits and build up over time.</p>
            </div>
            <Switch
              checked={form.warmupEnabled}
              onCheckedChange={(checked) => setForm({ ...form, warmupEnabled: checked })}
            />
          </div>

          {form.warmupEnabled && (
            <div>
              <Label>Ramp length (days)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={form.warmupDays}
                onChange={(e) => setForm({ ...form, warmupDays: Number(e.target.value) })}
              />
            </div>
          )}

          <div>
            <Label>Timezone</Label>
            <Input
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              placeholder="Asia/Karachi"
            />
          </div>

          <div>
            <Label className="mb-2 block">Working hours</Label>
            <div className="space-y-2">
              {form.workingHours.map((slot, index) => (
                <div key={slot.day} className="flex items-center gap-2">
                  <Switch
                    checked={slot.enabled}
                    onCheckedChange={(checked) => {
                      const next = [...form.workingHours]
                      next[index] = { ...slot, enabled: checked }
                      setForm({ ...form, workingHours: next })
                    }}
                  />
                  <span className="w-10 text-sm">{DAY_NAMES[slot.day]}</span>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    className="w-20"
                    value={slot.startHour}
                    disabled={!slot.enabled}
                    onChange={(e) => {
                      const next = [...form.workingHours]
                      next[index] = { ...slot, startHour: Number(e.target.value) }
                      setForm({ ...form, workingHours: next })
                    }}
                  />
                  <span className="text-sm text-gray-400">to</span>
                  <Input
                    type="number"
                    min={1}
                    max={24}
                    className="w-20"
                    value={slot.endHour}
                    disabled={!slot.enabled}
                    onChange={(e) => {
                      const next = [...form.workingHours]
                      next[index] = { ...slot, endHour: Number(e.target.value) }
                      setForm({ ...form, workingHours: next })
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving} className="bg-cyan-500 hover:bg-cyan-600">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
