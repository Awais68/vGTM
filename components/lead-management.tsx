"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Download, Upload, List, Settings, Trash2, Mail, ExternalLink } from "lucide-react"

interface Lead {
  id: string
  fullName: string
  headline: string
  jobTitle: string
  company: string
  location: string
  emailAddress?: string
  linkedinUrl: string
  about: string
  avatar?: string
}

export function LeadManagement() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])

  const leads: Lead[] = [
    {
      id: "1",
      fullName: "SN Hridoy",
      headline: "🚀 Helping Age...",
      jobTitle: "Digital Marketing...",
      company: "Sell Squads",
      location: "Dhaka, Bangladesh",
      linkedinUrl: "https://www.linkedin.com/in/snhridoy",
      about: "Hey!! My Name Is ...",
      avatar: "/professional-man.png",
    },
    {
      id: "2",
      fullName: "Bilal Rafique",
      headline: "Scaling SaaS wit...",
      jobTitle: "Lead Generation",
      company: "Fiverr",
      location: "Sahiwal District",
      linkedinUrl: "https://www.linkedin.com/in/bilalrafique",
      about: "/",
      avatar: "/professional-man-2.png",
    },
    {
      id: "3",
      fullName: "Haider Mansoor",
      headline: "USA Real Estate ...",
      jobTitle: "/",
      company: "/",
      location: "Karachi Division",
      linkedinUrl: "https://www.linkedin.com/in/haidermansoor",
      about: "/",
      avatar: "/professional-man-3.png",
    },
    {
      id: "4",
      fullName: "Usman Tahir",
      headline: "Digital Marketing...",
      jobTitle: "Chief Technology...",
      company: "MasDevs",
      location: "Pakpattan District",
      linkedinUrl: "https://www.linkedin.com/in/usmantahir",
      about: "/",
      avatar: "/professional-man-4.jpg",
    },
    {
      id: "5",
      fullName: "Areej Mahmood",
      headline: "Lead Generating...",
      jobTitle: "Copywriter",
      company: "Upwork",
      location: "Lahore",
      linkedinUrl: "https://www.linkedin.com/in/areejmahmood",
      about: "/",
      avatar: "/professional-woman-diverse.png",
    },
    {
      id: "6",
      fullName: "Ayesha Noman",
      headline: "Lead Generation...",
      jobTitle: "/",
      company: "/",
      location: "Karachi Division",
      linkedinUrl: "https://www.linkedin.com/in/ayeshanoman",
      about: "/",
      avatar: "/professional-woman-2.png",
    },
    {
      id: "7",
      fullName: "Fiaz Ahmad",
      headline: "Lead Generation...",
      jobTitle: "/",
      company: "/",
      location: "Dera Ghazi Khan",
      linkedinUrl: "https://www.linkedin.com/in/fiazmad",
      about: "/",
      avatar: "/professional-man-5.jpg",
    },
    {
      id: "8",
      fullName: "Syed Bilal Hussain",
      headline: "🚀 Founder at K...",
      jobTitle: "Founder",
      company: "KodersKube",
      location: "Karachi",
      linkedinUrl: "https://www.linkedin.com/in/syedbilalhussain",
      about: "/",
      avatar: "/professional-man-6.jpg",
    },
    {
      id: "9",
      fullName: "Nasir Ali",
      headline: "Lead Generation...",
      jobTitle: "Co-Founder & L...",
      company: "ListPark - Lead ...",
      location: "Rawalpindi",
      linkedinUrl: "https://www.linkedin.com/in/nasirali",
      about: "/",
      avatar: "/professional-man-7.jpg",
    },
    {
      id: "10",
      fullName: "Arsalan Farooq",
      headline: "I help B2B busin...",
      jobTitle: "Founder",
      company: "AB Digital Growth",
      location: "Karachi",
      linkedinUrl: "https://www.linkedin.com/in/arsalanfarooq",
      about: "Welcome! This is ...",
      avatar: "/professional-man-8.jpg",
    },
  ]

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads((prev) => (prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]))
  }

  const toggleSelectAll = () => {
    setSelectedLeads((prev) => (prev.length === leads.length ? [] : leads.map((lead) => lead.id)))
  }

  const filteredLeads = leads.filter(
    (lead) =>
      lead.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.headline.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">First Text</h1>
          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
        <Button className="bg-cyan-500 hover:bg-cyan-600">
          <Settings className="w-4 h-4 mr-2" />
          Edit Columns
        </Button>
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

        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export to CSV
        </Button>

        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export to CRM
        </Button>

        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>

        <Button variant="outline">
          <List className="w-4 h-4 mr-2" />
          List Details
        </Button>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">
                  <Checkbox checked={selectedLeads.length === leads.length} onCheckedChange={toggleSelectAll} />
                </th>
                <th className="text-left p-4 font-medium text-gray-600">Full Name</th>
                <th className="text-left p-4 font-medium text-gray-600">Headline</th>
                <th className="text-left p-4 font-medium text-gray-600">Job Title</th>
                <th className="text-left p-4 font-medium text-gray-600">Company</th>
                <th className="text-left p-4 font-medium text-gray-600">Location</th>
                <th className="text-left p-4 font-medium text-gray-600">Email Address</th>
                <th className="text-left p-4 font-medium text-gray-600">LinkedIn URL</th>
                <th className="text-left p-4 font-medium text-gray-600">About</th>
                <th className="text-left p-4 font-medium text-gray-600">Remove</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => toggleLeadSelection(lead.id)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={lead.avatar || "/placeholder.svg"} alt={lead.fullName} />
                        <AvatarFallback className="bg-gray-200 text-gray-600">
                          {lead.fullName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{lead.fullName}</span>
                    </div>
                  </td>
                  <td className="p-4 max-w-xs">
                    <div className="truncate" title={lead.headline}>
                      {lead.headline}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="truncate" title={lead.jobTitle}>
                      {lead.jobTitle}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="truncate" title={lead.company}>
                      {lead.company}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="truncate" title={lead.location}>
                      {lead.location}
                    </div>
                  </td>
                  <td className="p-4">
                    {lead.emailAddress ? (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{lead.emailAddress}</span>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-cyan-600 border-cyan-200 hover:bg-cyan-50 bg-transparent"
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Find email
                      </Button>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <a
                        href={lead.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                      >
                        <span className="truncate max-w-[150px]" title={lead.linkedinUrl}>
                          {lead.linkedinUrl}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </td>
                  <td className="p-4 max-w-xs">
                    <div className="truncate" title={lead.about}>
                      {lead.about}
                    </div>
                  </td>
                  <td className="p-4">
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedLeads.length > 0 && (
        <div className="mt-4 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-cyan-700">
              {selectedLeads.length} lead{selectedLeads.length !== 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Export Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50 bg-transparent"
              >
                Delete Selected
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
