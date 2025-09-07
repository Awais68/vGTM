"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Search } from "lucide-react"

interface NetworkContact {
  id: string
  name: string
  headline: string
  jobTitle: string
  company: string
  location: string
}

export function MyNetwork() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectMode, setSelectMode] = useState(false)

  const contacts: NetworkContact[] = [
    {
      id: "1",
      name: "Ammar Khan",
      headline: "UI/UX Designer | Web Designer ...",
      jobTitle: "/",
      company: "/",
      location: "/",
    },
    {
      id: "2",
      name: "Zafor Iqbal",
      headline: "UI/UX Designer & Founder of Vo...",
      jobTitle: "/",
      company: "/",
      location: "/",
    },
    {
      id: "3",
      name: "Hoorain Salman",
      headline: "Generated $10k+ as a Entrepre...",
      jobTitle: "Senior Instructor",
      company: "Alkhidmat Karachi",
      location: "Karachi, Sindh, Pakistan",
    },
    {
      id: "4",
      name: "Muhammad Maaz",
      headline: "Software Engineering Student ...",
      jobTitle: "Junior Data Analyst",
      company: "Cloud Fusion Global",
      location: "Karachi Division, Sindh, Pakistan",
    },
    {
      id: "5",
      name: "Usman Sheikh",
      headline: "PHP | Laravel | MySQL | HTML | ...",
      jobTitle: "/",
      company: "/",
      location: "/",
    },
    {
      id: "6",
      name: "Andrej Potočnik",
      headline: "Graphic Designer",
      jobTitle: "/",
      company: "/",
      location: "/",
    },
    {
      id: "7",
      name: "Zahid Hussain",
      headline: "CEO & Co-founder, Proving solu...",
      jobTitle: "Graphic Designer",
      company: "Shaheen Printers & Graphics",
      location: "Multan, Punjab, Pakistan",
    },
    {
      id: "8",
      name: "Rana Sheraz",
      headline: "Graphic & UX/UI Designer | UX ...",
      jobTitle: "/",
      company: "/",
      location: "Islamabad",
    },
    {
      id: "9",
      name: "Philip Ewere",
      headline: "Managing Director at Cool The ...",
      jobTitle: "/",
      company: "/",
      location: "/",
    },
    {
      id: "10",
      name: "Print Pen",
      headline: "Graphic Designer at Graphic De...",
      jobTitle: "/",
      company: "/",
      location: "/",
    },
  ]

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.headline.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">My network</h1>

      <div className="flex items-center gap-4 mb-6">
        <Select defaultValue="all">
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Filter by account</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search by keyword"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={selectMode} onCheckedChange={setSelectMode} />
          <span className="text-sm">Select mode</span>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="grid grid-cols-5 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-600">
          <div>Name</div>
          <div>Headline</div>
          <div>Job title</div>
          <div>Company</div>
          <div>Location</div>
        </div>

        {filteredContacts.map((contact) => (
          <div key={contact.id} className="grid grid-cols-5 gap-4 p-4 border-b items-center hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {contact.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{contact.name}</span>
            </div>
            <div className="truncate" title={contact.headline}>
              {contact.headline}
            </div>
            <div className="truncate" title={contact.jobTitle}>
              {contact.jobTitle}
            </div>
            <div className="truncate" title={contact.company}>
              {contact.company}
            </div>
            <div className="truncate" title={contact.location}>
              {contact.location}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
