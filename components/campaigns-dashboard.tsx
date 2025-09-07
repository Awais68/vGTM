"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Plus, Search, ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface CampaignsDashboardProps {
  onCreateCampaign: () => void
  onViewCampaign: (campaignId: string) => void
}

export function CampaignsDashboard({ onCreateCampaign, onViewCampaign }: CampaignsDashboardProps) {
  const [isCompanySelectOpen, setIsCompanySelectOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState("Peak Corporate Solution")

  const campaigns = [
    {
      id: "1",
      name: "First Campaign",
      status: "Draft",
      performance: { open: "0%", click: "0%", reply: "0%" },
      progress: { sent: 0, replied: 0, total: 0 },
      senders: 1,
    },
    {
      id: "2",
      name: "LinkedIn Outreach Q4",
      status: "Active",
      performance: { open: "12%", click: "3%", reply: "8%" },
      progress: { sent: 45, replied: 3, total: 150 },
      senders: 2,
    },
    {
      id: "3",
      name: "Sales Prospecting",
      status: "Paused",
      performance: { open: "18%", click: "5%", reply: "12%" },
      progress: { sent: 89, replied: 11, total: 200 },
      senders: 3,
    },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Active":
        return "bg-green-100 text-green-800"
      case "Draft":
        return "bg-yellow-100 text-yellow-800"
      case "Paused":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="p-6">
      <style jsx>{`
        .custom-select-button {
          color: #111827 !important;
        }
        .custom-select-button span {
          color: #111827 !important;
        }
        .custom-select-button * {
          color: #111827 !important;
        }
      `}</style>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setIsCompanySelectOpen(!isCompanySelectOpen)}
              className="custom-select-button w-48 h-10 px-3 py-2 bg-white border border-gray-300 rounded-md font-medium text-sm flex items-center justify-between hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              style={{
                color: "#111827 !important",
                backgroundColor: "#ffffff",
              }}
            >
              <span
                className="custom-select-text"
                style={{
                  color: "#111827 !important",
                  fontWeight: "500",
                }}
              >
                {selectedCompany}
              </span>
              <ChevronDown className="w-4 h-4" style={{ color: "#6b7280" }} />
            </button>
            {isCompanySelectOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-10">
                <button
                  onClick={() => {
                    setSelectedCompany("Peak Corporate Solution")
                    setIsCompanySelectOpen(false)
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm"
                  style={{
                    color: "#111827 !important",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <span style={{ color: "#111827 !important" }}>Peak Corporate Solution</span>
                </button>
              </div>
            )}
          </div>
          <Button onClick={onCreateCampaign} className="bg-cyan-500 hover:bg-cyan-600">
            <Plus className="w-4 h-4 mr-2" />
            Start new campaign
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <Select defaultValue="all">
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input placeholder="Search by title or description" className="pl-10" />
        </div>

        <Select defaultValue="senders">
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="senders">Select senders</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="grid grid-cols-12 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-600">
          <div className="col-span-1">Status</div>
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Performance</div>
          <div className="col-span-2">Progress</div>
          <div className="col-span-2">Senders</div>
          <div className="col-span-1"></div>
        </div>

        {campaigns.map((campaign) => (
          <div key={campaign.id} className="grid grid-cols-12 gap-4 p-4 border-b items-center hover:bg-gray-50">
            <div className="col-span-1">
              <Badge className={getStatusColor(campaign.status)}>{campaign.status}</Badge>
            </div>
            <div className="col-span-3">
              <div
                className="font-medium cursor-pointer hover:text-cyan-600 transition-colors"
                onClick={() => onViewCampaign(campaign.id)}
              >
                {campaign.name}
              </div>
              <div className="text-sm text-gray-500">
                {campaign.progress.sent} sent • {campaign.progress.total - campaign.progress.sent} left
              </div>
            </div>
            <div className="col-span-3">
              <div className="flex gap-2 text-sm">
                <span className="bg-blue-50 border border-blue-200 text-blue-700 px-2 py-1 rounded text-xs">
                  📊 {campaign.performance.open}
                </span>
                <span className="bg-green-50 border border-green-200 text-green-700 px-2 py-1 rounded text-xs">
                  📧 {campaign.performance.click}
                </span>
                <span className="bg-purple-50 border border-purple-200 text-purple-700 px-2 py-1 rounded text-xs">
                  💬 {campaign.performance.reply}
                </span>
              </div>
            </div>
            <div className="col-span-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">{campaign.progress.sent}</span>
                <span className="text-pink-500">{campaign.progress.replied}</span>
                <span className="text-green-500">✓ {campaign.progress.total}</span>
              </div>
            </div>
            <div className="col-span-2">
              <span className="text-sm">{campaign.senders}</span>
            </div>
            <div className="col-span-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => onViewCampaign(campaign.id)}>View</DropdownMenuItem>
                  <DropdownMenuItem>Edit</DropdownMenuItem>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        <div className="p-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing 1-{campaigns.length} of {campaigns.length}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
