"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Plus, Search, Loader2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface CampaignsDashboardProps {
  onCreateCampaign: () => void
  onViewCampaign: (campaignId: string) => void
}

interface Campaign {
  id: string
  name: string
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED"
  sentCount: number
  totalCount: number
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  DRAFT: "bg-yellow-100 text-yellow-800",
  PAUSED: "bg-gray-100 text-gray-800",
  COMPLETED: "bg-blue-100 text-blue-800",
}

export function CampaignsDashboard({ onCreateCampaign, onViewCampaign }: CampaignsDashboardProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  useEffect(() => {
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setCampaigns(json.data)
        else toast.error(json.error ?? "Could not load campaigns")
      })
      .catch(() => toast.error("Could not load campaigns"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) &&
        (statusFilter === "all" || c.status === statusFilter.toUpperCase())
    )
  }, [campaigns, search, statusFilter])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Button onClick={onCreateCampaign} className="bg-cyan-500 hover:bg-cyan-600">
          <Plus className="w-4 h-4 mr-2" />
          Start new campaign
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by name"
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-600">
          <div className="col-span-2">Status</div>
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Progress</div>
          <div className="col-span-2">Created</div>
          <div className="col-span-1"></div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
            Loading campaigns...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {campaigns.length === 0
              ? "No campaigns yet. Create one, import leads, then generate drafts in the Send Queue."
              : "No campaigns match that filter."}
          </div>
        ) : (
          filtered.map((campaign) => {
            const pct = campaign.totalCount
              ? Math.round((campaign.sentCount / campaign.totalCount) * 100)
              : 0
            return (
              <div
                key={campaign.id}
                className="grid grid-cols-12 gap-4 p-4 border-b items-center hover:bg-gray-50"
              >
                <div className="col-span-2">
                  <Badge className={STATUS_COLORS[campaign.status] ?? "bg-gray-100 text-gray-800"}>
                    {campaign.status}
                  </Badge>
                </div>
                <div className="col-span-4">
                  <button
                    className="font-medium text-left hover:text-cyan-600 transition-colors"
                    onClick={() => onViewCampaign(campaign.id)}
                  >
                    {campaign.name}
                  </button>
                </div>
                <div className="col-span-3">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="h-2 w-24 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-cyan-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-gray-600">
                      {campaign.sentCount} / {campaign.totalCount || 0}
                    </span>
                  </div>
                </div>
                <div className="col-span-2 text-sm text-gray-500">
                  {new Date(campaign.createdAt).toLocaleDateString()}
                </div>
                <div className="col-span-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewCampaign(campaign.id)}>
                        View analytics
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })
        )}

        <div className="p-4 text-sm text-gray-600">
          Showing {filtered.length} of {campaigns.length}
        </div>
      </div>
    </div>
  )
}
