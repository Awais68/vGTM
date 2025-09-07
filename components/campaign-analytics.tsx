"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit, MoreHorizontal, BarChart3, TrendingUp, Users, Target } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface CampaignAnalyticsProps {
  onBack: () => void
}

export function CampaignAnalytics({ onBack }: CampaignAnalyticsProps) {
  const [activeTab, setActiveTab] = useState(1)

  const analyticsSteps = [
    { number: 1, title: "Campaign Performance", icon: BarChart3 },
    { number: 2, title: "Sequence Performance", icon: TrendingUp },
    { number: 3, title: "Sender Performance", icon: Users },
    { number: 4, title: "Lead Analytics", icon: Target },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 1:
        return (
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="font-medium mb-4">Campaign progress</h3>
              <div className="text-3xl font-bold mb-2">0 %</div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-cyan-500 rounded"></div>
                    Status:
                  </span>
                  <Badge className="bg-cyan-100 text-cyan-800">Ongoing</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Started on:</span>
                  <span>4-Sep-2025</span>
                </div>
                <div className="flex justify-between">
                  <span>Total leads:</span>
                  <span>215</span>
                </div>
                <div className="flex justify-between">
                  <span>Excluded leads:</span>
                  <span>0</span>
                </div>
                <div className="flex justify-between">
                  <span>In the sequence:</span>
                  <span>35</span>
                </div>
                <div className="flex justify-between">
                  <span>Pending:</span>
                  <span>180</span>
                </div>
                <div className="flex justify-between">
                  <span>Paused:</span>
                  <span>0</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <span>0</span>
                </div>
                <div className="flex justify-between">
                  <span>Finished:</span>
                  <span>0</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-4">Campaign dashboard</h3>
              <div className="bg-gray-50 rounded-lg p-6 h-64">
                <div className="h-full flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm text-gray-600">Campaign Progress Over Time</span>
                    <div className="flex gap-2">
                      <div className="w-3 h-3 bg-cyan-500 rounded"></div>
                      <span className="text-xs text-gray-600">Sent</span>
                      <div className="w-3 h-3 bg-green-500 rounded ml-2"></div>
                      <span className="text-xs text-gray-600">Replied</span>
                    </div>
                  </div>
                  <div className="flex-1 flex items-end justify-between gap-2">
                    {[5, 3, 8, 4, 6, 2, 7].map((height, index) => (
                      <div key={index} className="flex flex-col items-center gap-1">
                        <div className="flex flex-col gap-1">
                          <div className="w-6 bg-cyan-500 rounded-t" style={{ height: `${height * 4}px` }}></div>
                          <div
                            className="w-6 bg-green-500 rounded-b"
                            style={{ height: `${Math.floor(height / 2) * 4}px` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500">{index + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <Button variant="outline">Cancel</Button>
                <Button variant="outline">Pause</Button>
                <Button className="bg-cyan-500 hover:bg-cyan-600">View workflow</Button>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="font-medium">Sequence Performance</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-cyan-600">0%</div>
                <div className="text-sm text-gray-600">Connection Rate</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">0%</div>
                <div className="text-sm text-gray-600">Response Rate</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">0</div>
                <div className="text-sm text-gray-600">Total Messages</div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 h-48 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <TrendingUp className="w-8 h-8 mx-auto mb-2" />
                <p>Sequence performance chart</p>
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h3 className="font-medium">Sender Performance</h3>
            <div className="bg-white border rounded-lg">
              <div className="grid grid-cols-4 gap-4 p-4 border-b bg-gray-50 text-sm font-medium text-gray-600">
                <div>Sender</div>
                <div>Messages Sent</div>
                <div>Connections</div>
                <div>Response Rate</div>
              </div>
              <div className="grid grid-cols-4 gap-4 p-4 items-center">
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gray-700 text-white text-sm">JD</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">John Doe</span>
                </div>
                <div>0</div>
                <div>0</div>
                <div>0%</div>
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="font-medium">Lead Analytics</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">215</div>
                <div className="text-sm text-gray-600">Total Leads</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600">35</div>
                <div className="text-sm text-gray-600">Active in Sequence</div>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 h-48 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Target className="w-8 h-8 mx-auto mb-2" />
                <p>Lead analytics visualization</p>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-semibold">View Campaign</h1>
        </div>
        <Button className="bg-cyan-500 hover:bg-cyan-600">
          <Edit className="w-4 h-4 mr-2" />
          Edit Campaign
        </Button>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold">First Campaign</h2>
            <Edit className="w-4 h-4 text-gray-400" />
          </div>
        </div>

        <div className="flex items-center gap-8 mb-8">
          {analyticsSteps.map((step, index) => (
            <div key={step.number} className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab(step.number)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  activeTab === step.number ? "bg-cyan-500 text-white" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                }`}
              >
                {step.number}
              </button>
              <span
                className={`text-sm cursor-pointer transition-colors ${
                  activeTab === step.number ? "text-cyan-600 font-medium" : "text-gray-600 hover:text-gray-800"
                }`}
                onClick={() => setActiveTab(step.number)}
              >
                {step.title}
              </span>
              {index < analyticsSteps.length - 1 && <div className="w-16 h-px bg-gray-300 ml-4"></div>}
            </div>
          ))}
        </div>

        {renderTabContent()}

        <div className="mt-8 pt-6 border-t">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Lead list</h3>
                <Button variant="outline" size="sm">
                  First Text
                </Button>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">215 leads total</div>
                <div className="text-sm text-gray-600">35 in sequence</div>
                <div className="text-sm text-gray-600">180 pending</div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-4">Campaign senders</h4>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gray-700 text-white text-sm">JD</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">John Doe</div>
                    <div className="text-sm text-gray-500">Free Account</div>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Configure</DropdownMenuItem>
                    <DropdownMenuItem>Remove</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
