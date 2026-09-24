"use client"

import { useCallback, useEffect, useState } from "react"
import { LoadErrorState } from "@/components/ui/load-error-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, ExternalLink, Loader2, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

type Outcome =
  | "CONNECTION_ACCEPTED"
  | "REPLIED"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "MEETING_BOOKED"
  | "UNSUBSCRIBED"

const OUTCOME_LABELS: { value: Outcome; label: string }[] = [
  { value: "CONNECTION_ACCEPTED", label: "Connection accepted" },
  { value: "REPLIED", label: "Replied" },
  { value: "INTERESTED", label: "Interested" },
  { value: "MEETING_BOOKED", label: "Meeting booked" },
  { value: "NOT_INTERESTED", label: "Not interested" },
  { value: "UNSUBSCRIBED", label: "Unsubscribe / do not contact" },
]

interface CampaignOption {
  id: string
  name: string
}

interface Lead {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  company: string | null
  jobTitle: string | null
  linkedinUrl: string | null
  status: string
  unsubscribed: boolean
  enrollment: { status: string; currentStep: number; nextSendAt: string | null } | null
}

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-gray-100 text-gray-700",
  CONTACTED: "bg-blue-100 text-blue-700",
  CONNECTED: "bg-blue-100 text-blue-700",
  REPLIED: "bg-purple-100 text-purple-700",
  INTERESTED: "bg-green-100 text-green-700",
  NOT_INTERESTED: "bg-red-100 text-red-700",
  PROPOSAL_SENT: "bg-cyan-100 text-cyan-700",
}

export function LeadManagement() {
  const [searchQuery, setSearchQuery] = useState("")
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>("")
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [campaignsVersion, setCampaignsVersion] = useState(0)

  useEffect(() => {
    async function fetchCampaigns() {
      setLoadError(null)
      try {
        const response = await fetch("/api/campaigns")
        const json = await response.json()
        if (!json.success) {
          setLoadError(json.error ?? "Could not load campaigns")
          return
        }
        const data: CampaignOption[] = json.data ?? []
        setCampaigns(data)
        if (data.length > 0) setSelectedCampaign(data[0].id)
      } catch {
        // Without campaigns the table would read "create a campaign to get
        // started", which is wrong when the request failed.
        setLoadError("Could not load campaigns. Check that the database is reachable.")
      }
    }
    fetchCampaigns()
  }, [campaignsVersion])

  const fetchLeads = useCallback(async () => {
    if (!selectedCampaign) {
      setLeads([])
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch(`/api/leads?campaignId=${selectedCampaign}`)
      const json = await response.json()
      if (json.success) setLeads(json.data)
      else setLoadError(json.error ?? "Could not load leads")
    } catch {
      setLoadError("Could not load leads. Check that the database is reachable.")
    } finally {
      setLoading(false)
    }
  }, [selectedCampaign])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  async function markOutcome(leadId: string, outcome: Outcome) {
    try {
      const response = await fetch(`/api/leads/${leadId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      })
      const json = await response.json()
      if (!json.success) {
        toast.error(json.error ?? "Could not save that outcome")
        return
      }
      // An outcome can also stop or pause the enrollment, so refetch the row
      // rather than patching status locally.
      await fetchLeads()
      toast.success("Outcome logged")
    } catch {
      toast.error("Could not save that outcome")
    }
  }

  const filteredLeads = leads.filter((lead) => {
    const fullName = `${lead.firstName} ${lead.lastName ?? ""}`.toLowerCase()
    const q = searchQuery.toLowerCase()
    return (
      fullName.includes(q) ||
      (lead.company ?? "").toLowerCase().includes(q) ||
      (lead.jobTitle ?? "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select a campaign..." />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search leads"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Full Name</th>
                <th className="text-left p-4 font-medium text-gray-600">Job Title</th>
                <th className="text-left p-4 font-medium text-gray-600">Company</th>
                <th className="text-left p-4 font-medium text-gray-600">Email</th>
                <th className="text-left p-4 font-medium text-gray-600">LinkedIn</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Sequence</th>
                <th className="text-left p-4 font-medium text-gray-600">Log</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
                    Loading leads...
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <LoadErrorState
                      message={loadError}
                      onRetry={() => (selectedCampaign ? fetchLeads() : setCampaignsVersion((v) => v + 1))}
                      bordered={false}
                    />
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    {campaigns.length === 0 ? "Create a campaign and import leads to get started." : "No leads found."}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="border-b hover:bg-gray-50">
                    <td className="p-4 font-medium">
                      {lead.firstName} {lead.lastName ?? ""}
                    </td>
                    <td className="p-4">
                      <div className="truncate max-w-[160px]" title={lead.jobTitle ?? ""}>
                        {lead.jobTitle ?? "-"}
                      </div>
                    </td>
                    <td className="p-4">{lead.company ?? "-"}</td>
                    <td className="p-4">{lead.email ?? "-"}</td>
                    <td className="p-4">
                      {lead.linkedinUrl ? (
                        <a
                          href={lead.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                        >
                          <span className="truncate max-w-[150px]">{lead.linkedinUrl}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-4">
                      <Badge className={STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-700"}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {lead.unsubscribed ? (
                        <Badge className="bg-gray-200 text-gray-600">Unsubscribed</Badge>
                      ) : lead.enrollment ? (
                        <Badge
                          className={
                            lead.enrollment.status === "NEEDS_REVIEW"
                              ? "bg-amber-100 text-amber-700"
                              : lead.enrollment.status === "ACTIVE"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                          }
                        >
                          {lead.enrollment.status}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">Not enrolled</span>
                      )}
                    </td>
                    <td className="p-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Log what happened</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {OUTCOME_LABELS.map((o) => (
                            <DropdownMenuItem
                              key={o.value}
                              className={o.value === "UNSUBSCRIBED" ? "text-red-600" : ""}
                              onClick={() => markOutcome(lead.id, o.value)}
                            >
                              {o.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
