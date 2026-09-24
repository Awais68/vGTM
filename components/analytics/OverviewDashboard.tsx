"use client"

import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"

interface Funnel {
  leads: number
  queued: number
  sent: number
  connected: number
  replied: number
  interested: number
  meetings: number
  connectionRate: number
  replyRate: number
  interestRate: number
}

interface Overview {
  funnel: Funnel
  series: { date: string; sent: number; connected: number; replied: number }[]
  steps: { channel: string; stepNumber: number; draft: number; ready: number; sent: number; skipped: number }[]
  statuses: { status: string; count: number }[]
  usage: { channel: string; sentToday: number; limit: number; overLimit: boolean }[]
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "#94a3b8",
  CONTACTED: "#38bdf8",
  CONNECTED: "#0ea5e9",
  REPLIED: "#a855f7",
  INTERESTED: "#22c55e",
  NOT_INTERESTED: "#ef4444",
  PROPOSAL_SENT: "#06b6d4",
}

export function OverviewDashboard({ onOpenQueue }: { onOpenQueue?: () => void }) {
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/analytics/overview?days=30")
      .then((r) => r.json())
      .then((json) => setData(json.success ? json.data : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
        Loading analytics...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          Could not load analytics. Check that the database is reachable.
        </div>
      </div>
    )
  }

  const { funnel, series, steps, statuses, usage } = data

  const cards = [
    { label: "Leads", value: funnel.leads, sub: `${funnel.queued} drafted & waiting` },
    { label: "Sent", value: funnel.sent, sub: "logged by you" },
    { label: "Connections", value: funnel.connected, sub: `${funnel.connectionRate}% of sent` },
    { label: "Replies", value: funnel.replied, sub: `${funnel.replyRate}% of sent` },
    { label: "Interested", value: funnel.interested, sub: `${funnel.interestRate}% of replies` },
    { label: "Meetings", value: funnel.meetings, sub: "booked" },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {onOpenQueue && (
          <button
            onClick={onOpenQueue}
            className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
          >
            Go to Send Queue →
          </button>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-semibold mt-1">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white rounded-lg border p-4 lg:col-span-2">
          <h3 className="font-medium mb-4">Last 30 days</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="sent" stroke="#06b6d4" fill="#cffafe" name="Sent" isAnimationActive={false} />
                <Area type="monotone" dataKey="connected" stroke="#0ea5e9" fill="#e0f2fe" name="Connected" isAnimationActive={false} />
                <Area type="monotone" dataKey="replied" stroke="#a855f7" fill="#f3e8ff" name="Replied" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-4">Lead status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statuses}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {statuses.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#cbd5e1"} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-4">Today&apos;s sending caps</h3>
          <div className="space-y-4">
            {usage.map((u) => (
              <div key={u.channel}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{u.channel.replace("LINKEDIN_", "").toLowerCase()}</span>
                  <span className={u.overLimit ? "text-red-600 font-medium" : "text-gray-500"}>
                    {u.sentToday} / {u.limit}
                  </span>
                </div>
                <Progress value={Math.min(100, (u.sentToday / u.limit) * 100)} className="h-2" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-4">Queue by step</h3>
          {steps.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing queued yet.</p>
          ) : (
            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  key={`${step.channel}-${step.stepNumber}`}
                  className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0"
                >
                  <span className="text-gray-600">
                    {step.channel.replace("LINKEDIN_", "").toLowerCase()}
                    {step.stepNumber > 0 ? ` · step ${step.stepNumber}` : ""}
                  </span>
                  <div className="flex gap-1">
                    <Badge variant="secondary">{step.draft} draft</Badge>
                    <Badge className="bg-green-100 text-green-700">{step.sent} sent</Badge>
                    {step.skipped > 0 && <Badge variant="outline">{step.skipped} skipped</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
