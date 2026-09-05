"use client"

import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2 } from "lucide-react"

interface CampaignAnalyticsProps {
  campaignId: string | null
  onBack: () => void
}

interface Payload {
  campaign: {
    id: string
    name: string
    status: string
    offerContext: string | null
    sentCount: number
    totalCount: number
    createdAt: string
  }
  funnel: {
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
  series: { date: string; sent: number; connected: number; replied: number }[]
  steps: { channel: string; stepNumber: number; draft: number; ready: number; sent: number; skipped: number }[]
  statuses: { status: string; count: number }[]
}

export function CampaignAnalytics({ campaignId, onBack }: CampaignAnalyticsProps) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!campaignId) {
      setLoading(false)
      setError("No campaign selected")
      return
    }
    setLoading(true)
    fetch(`/api/analytics/campaigns/${campaignId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data)
        else setError(json.error ?? "Could not load campaign analytics")
      })
      .catch(() => setError("Could not load campaign analytics"))
      .finally(() => setLoading(false))
  }, [campaignId])

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
        Loading campaign...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">{error}</div>
      </div>
    )
  }

  const { campaign, funnel, series, steps, statuses } = data

  const progress = funnel.leads ? Math.round((funnel.sent / funnel.leads) * 100) : 0

  const metrics = [
    { label: "Leads", value: funnel.leads },
    { label: "Waiting in queue", value: funnel.queued },
    { label: "Sent", value: funnel.sent },
    { label: "Connected", value: `${funnel.connected} (${funnel.connectionRate}%)` },
    { label: "Replied", value: `${funnel.replied} (${funnel.replyRate}%)` },
    { label: "Interested", value: funnel.interested },
    { label: "Meetings", value: funnel.meetings },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>
          <Badge className="bg-cyan-100 text-cyan-800">{campaign.status}</Badge>
        </div>
        <span className="text-sm text-gray-500">
          Started {new Date(campaign.createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Campaign progress</h3>
          <span className="text-2xl font-semibold">{progress}%</span>
        </div>
        <div className="h-2 w-full bg-gray-100 rounded overflow-hidden">
          <div className="h-full bg-cyan-500" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-7">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">{m.label}</p>
            <p className="text-xl font-semibold mt-1">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-4">Daily activity (30 days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" fill="#06b6d4" name="Sent" isAnimationActive={false} />
                <Bar dataKey="connected" fill="#0ea5e9" name="Connected" isAnimationActive={false} />
                <Bar dataKey="replied" fill="#a855f7" name="Replied" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-4">Sequence steps</h3>
          {steps.length === 0 ? (
            <p className="text-sm text-gray-400">No drafts generated for this campaign yet.</p>
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

          <h3 className="font-medium mt-6 mb-3">Lead status</h3>
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <Badge key={s.status} variant="outline">
                {s.status}: {s.count}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {campaign.offerContext && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-medium mb-2">Offer context used by the AI</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{campaign.offerContext}</p>
        </div>
      )}
    </div>
  )
}
