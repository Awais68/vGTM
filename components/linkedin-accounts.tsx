"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Search,
  Plus,
  Settings,
  MoreHorizontal,
  Clock,
  Unplug,
  RefreshCw,
  Shield,
  Wifi,
  LogIn,
  UserPlus,
} from "lucide-react"

interface LinkedInAccount {
  id: string
  name: string
  status: "Available" | "Busy" | "Disconnected"
  sendingLimits: {
    follows: number
    messages: number
    profileViews: number
  }
  subscription: "Free Account" | "Premium" | "Sales Navigator"
  campaignCount: number
  email: string
  isSelected?: boolean
}

export function LinkedInAccounts() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showLimitsModal, setShowLimitsModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<LinkedInAccount | null>(null)
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [authForm, setAuthForm] = useState({ email: "", password: "" })

  const [accounts, setAccounts] = useState<LinkedInAccount[]>([
    {
      id: "1",
      name: "John Doe",
      status: "Available",
      sendingLimits: { follows: 25, messages: 40, profileViews: 60 },
      subscription: "Free Account",
      campaignCount: 0,
      email: "john.doe@example.com",
    },
    {
      id: "2",
      name: "Sarah Wilson",
      status: "Available",
      sendingLimits: { follows: 40, messages: 60, profileViews: 80 },
      subscription: "Premium",
      campaignCount: 2,
      email: "sarah.wilson@example.com",
    },
    {
      id: "3",
      name: "Mike Johnson",
      status: "Busy",
      sendingLimits: { follows: 60, messages: 80, profileViews: 100 },
      subscription: "Sales Navigator",
      campaignCount: 5,
      email: "mike.johnson@example.com",
    },
    {
      id: "4",
      name: "Emily Chen",
      status: "Available",
      sendingLimits: { follows: 30, messages: 50, profileViews: 70 },
      subscription: "Premium",
      campaignCount: 1,
      email: "emily.chen@example.com",
    },
    {
      id: "5",
      name: "David Brown",
      status: "Disconnected",
      sendingLimits: { follows: 20, messages: 30, profileViews: 40 },
      subscription: "Free Account",
      campaignCount: 0,
      email: "david.brown@example.com",
    },
  ])

  const [senderLimits, setSenderLimits] = useState({
    maxFollows: [40],
    maxMessages: [40],
    maxInMailMessages: [40],
    maxConnectionRequests: [25],
    maxProfileViews: [40],
    maxPostLikes: [40],
  })

  const [weeklySchedule, setWeeklySchedule] = useState({
    monday: { enabled: true, start: 0, end: 24 },
    tuesday: { enabled: true, start: 0, end: 24 },
    wednesday: { enabled: true, start: 0, end: 24 },
    thursday: { enabled: true, start: 0, end: 24 },
    friday: { enabled: true, start: 0, end: 24 },
    saturday: { enabled: true, start: 0, end: 24 },
    sunday: { enabled: true, start: 0, end: 24 },
  })

  const filteredAccounts = accounts.filter((account) => account.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleSelectAccount = (accountId: string, checked: boolean) => {
    if (checked) {
      setSelectedAccounts([...selectedAccounts, accountId])
    } else {
      setSelectedAccounts(selectedAccounts.filter((id) => id !== accountId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAccounts(filteredAccounts.map((account) => account.id))
    } else {
      setSelectedAccounts([])
    }
  }

  const handleAuthentication = () => {
    console.log("[v0] Authenticating with:", authForm)
    const newAccount: LinkedInAccount = {
      id: Date.now().toString(),
      name: authForm.email
        .split("@")[0]
        .replace(".", " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()),
      status: "Available",
      sendingLimits: { follows: 25, messages: 40, profileViews: 60 },
      subscription: "Free Account",
      campaignCount: 0,
      email: authForm.email,
    }
    setAccounts([...accounts, newAccount])
    setAuthForm({ email: "", password: "" })
    setShowAuthModal(false)
  }

  const openScheduleModal = (account: LinkedInAccount) => {
    setSelectedAccount(account)
    setShowScheduleModal(true)
  }

  const openLimitsModal = (account: LinkedInAccount) => {
    setSelectedAccount(account)
    setShowLimitsModal(true)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Available":
        return "bg-green-100 text-green-800"
      case "Busy":
        return "bg-yellow-100 text-yellow-800"
      case "Disconnected":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatTime = (hour: number) => {
    if (hour === 0) return "12 AM"
    if (hour === 12) return "12 PM"
    if (hour < 12) return `${hour} AM`
    return `${hour - 12} PM`
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">LinkedIn Accounts</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAuthModal(true)}>
            <LogIn className="w-4 h-4 mr-2" />
            Add Account
          </Button>
          <Button className="bg-cyan-500 hover:bg-cyan-600">
            <Plus className="w-4 h-4 mr-2" />
            Connect account
          </Button>
        </div>
      </div>

      <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-sm">i</span>
          </div>
          <div className="text-sm text-cyan-700">
            <span className="font-medium">The LinkedIn accounts are called senders</span> when put in a campaign.{" "}
            <span className="font-medium">Connect multiple LinkedIn sending accounts on one campaign</span> to increase
            your daily sending volume.
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search senders"
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select defaultValue="all">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="busy">Busy</SelectItem>
              <SelectItem value="disconnected">Disconnected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {selectedAccounts.length > 0 && (
            <span className="text-sm text-cyan-600 font-medium">
              {selectedAccounts.length} account{selectedAccounts.length > 1 ? "s" : ""} selected
            </span>
          )}
          <span className="text-sm text-green-600 font-medium">Unlimited seats available</span>
          <Button variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Purchase seats
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="grid grid-cols-6 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-600">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedAccounts.length === filteredAccounts.length && filteredAccounts.length > 0}
              onCheckedChange={handleSelectAll}
            />
            LinkedIn Account
          </div>
          <div>Status</div>
          <div>Subscription</div>
          <div>Sending limits</div>
          <div></div>
          <div></div>
        </div>

        {filteredAccounts.map((account) => (
          <div key={account.id} className="grid grid-cols-6 gap-4 p-4 border-b items-center">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedAccounts.includes(account.id)}
                onCheckedChange={(checked) => handleSelectAccount(account.id, checked as boolean)}
              />
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-gray-700 text-white">
                  {account.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{account.name}</div>
                <div className="text-xs text-gray-500">{account.email}</div>
              </div>
            </div>

            <div>
              <Badge className={getStatusColor(account.status)}>✓ {account.status}</Badge>
            </div>

            <div>
              <span className="text-sm text-gray-600">{account.subscription}</span>
              <div className="text-xs text-gray-400">In {account.campaignCount} campaigns</div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
                📊 {account.sendingLimits.follows}/day
              </Badge>
              <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                📧 {account.sendingLimits.messages}/day
              </Badge>
              <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
                👁️ {account.sendingLimits.profileViews}/day
              </Badge>
            </div>

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openLimitsModal(account)}
                className="text-gray-600 border-gray-300"
              >
                <Settings className="w-4 h-4 mr-1" />
                Configure limits
              </Button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem className="text-red-600">
                    <Unplug className="w-4 h-4 mr-2" />
                    Disconnect
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Re-sync
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openLimitsModal(account)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Configure sending limits
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openScheduleModal(account)}>
                    <Clock className="w-4 h-4 mr-2" />
                    Configure working hours
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Wifi className="w-4 h-4 mr-2" />
                    Configure proxy
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Shield className="w-4 h-4 mr-2" />
                    Inbox privacy configuration
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}

        <div className="p-4 text-sm text-gray-600">
          Showing {filteredAccounts.length} of {accounts.length}
        </div>
      </div>

      <Dialog open={showAuthModal} onOpenChange={setShowAuthModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Add LinkedIn Account
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="Enter your LinkedIn email"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="Enter your LinkedIn password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-700">
                <strong>Note:</strong> Your credentials are encrypted and stored securely. We use them only to manage
                your LinkedIn outreach campaigns.
              </p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAuthModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAuthentication}
                className="bg-cyan-500 hover:bg-cyan-600"
                disabled={!authForm.email || !authForm.password}
              >
                Add Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Setup sender schedule</DialogTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  Go to sender limits
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowScheduleModal(false)}>
                  ✕
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {Object.entries(weeklySchedule).map(([day, schedule]) => (
              <div key={day} className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={(e) =>
                      setWeeklySchedule((prev) => ({
                        ...prev,
                        [day]: { ...prev[day as keyof typeof prev], enabled: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 text-cyan-600"
                  />
                  <span className="font-medium capitalize w-24">{day} Schedule</span>
                </div>

                {schedule.enabled && (
                  <div className="ml-7">
                    <div className="flex items-center gap-4 mb-2">
                      <span className="text-sm text-gray-600">0 AM</span>
                      <span className="text-sm text-gray-600">6 AM</span>
                      <span className="text-sm text-gray-600">12 PM</span>
                      <span className="text-sm text-gray-600">6 PM</span>
                      <span className="text-sm text-gray-600">12 AM</span>
                    </div>
                    <div className="relative h-8 bg-gray-200 rounded-full">
                      <div
                        className="absolute h-full bg-cyan-500 rounded-full"
                        style={{
                          left: `${(schedule.start / 24) * 100}%`,
                          width: `${((schedule.end - schedule.start) / 24) * 100}%`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-2">
                        {[0, 6, 12, 18, 24].map((hour) => (
                          <div key={hour} className="w-px h-4 bg-white/50" />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowScheduleModal(false)} className="bg-cyan-500 hover:bg-cyan-600">
              Save settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showLimitsModal} onOpenChange={setShowLimitsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Setup sender limits</DialogTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowLimitsModal(false)}>
                ✕
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-gray-700 text-white">
                  {selectedAccount?.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("") || "JD"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{selectedAccount?.name || "John Doe"}</div>
                <Button variant="outline" size="sm" className="mt-1 bg-transparent">
                  Go to sender schedule
                </Button>
              </div>
            </div>

            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
              <p className="text-sm text-cyan-700">
                <strong>Note:</strong> The numbers below may vary based on your account's health and activities on other
                campaigns. We do this to keep your accounts safe.
              </p>
            </div>

            <div className="space-y-6">
              {[
                { key: "maxFollows", label: "Max Follows/day", value: senderLimits.maxFollows },
                { key: "maxMessages", label: "Max Messages/day", value: senderLimits.maxMessages },
                { key: "maxInMailMessages", label: "Max InMail Messages/day", value: senderLimits.maxInMailMessages },
                {
                  key: "maxConnectionRequests",
                  label: "Max Connection Requests/day",
                  value: senderLimits.maxConnectionRequests,
                },
                { key: "maxProfileViews", label: "Max Profile Views/day", value: senderLimits.maxProfileViews },
                { key: "maxPostLikes", label: "Max Post Likes/day", value: senderLimits.maxPostLikes },
              ].map((limit) => (
                <div key={limit.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">{limit.label}</label>
                    <span className="text-sm font-medium">{limit.value[0]}</span>
                  </div>
                  <Slider
                    value={limit.value}
                    onValueChange={(value) =>
                      setSenderLimits((prev) => ({
                        ...prev,
                        [limit.key]: value,
                      }))
                    }
                    max={100}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => setShowLimitsModal(false)} className="bg-cyan-500 hover:bg-cyan-600">
              Save settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
