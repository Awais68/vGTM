"use client"

import { cn } from "@/lib/utils"
import { LayoutDashboard, Snowflake, Linkedin, Database, Search, TrendingUp, Settings, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useState } from "react"

interface SidebarProps {
  activeView: string
  onViewChange: (view: string) => void
}

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const [coldOutreachOpen, setColdOutreachOpen] = useState(false)
  const [linkedinOpen, setLinkedinOpen] = useState(true)

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      id: "cold-outreach",
      label: "Cold Outreach",
      icon: Snowflake,
      hasSubmenu: true,
      isOpen: coldOutreachOpen,
      onToggle: () => setColdOutreachOpen(!coldOutreachOpen),
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      icon: Linkedin,
      hasSubmenu: true,
      isOpen: linkedinOpen,
      onToggle: () => setLinkedinOpen(!linkedinOpen),
      submenu: [
        { id: "linkedin-accounts", label: "LinkedIn Accounts" },
        { id: "send-queue", label: "Send Queue" },
        { id: "leads", label: "Leads" },
        { id: "my-network", label: "My network" },
        { id: "campaigns", label: "Campaigns" },
        { id: "inbox", label: "Inbox" },
        { id: "needs-review", label: "Needs Review" },
      ],
    },
    { id: "ad-data", label: "Ad Data", icon: Database },
    { id: "seo", label: "SEO", icon: Search },
    { id: "influencers", label: "Influencers", icon: TrendingUp },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-cyan-500 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">GTM</span>
          </div>
          <span className="font-bold text-lg">
            GTM<span className="text-cyan-500">100</span>
          </span>
        </div>
      </div>

      <nav className="flex-1 px-2">
        {menuItems.map((item) => (
          <div key={item.id}>
            {item.hasSubmenu ? (
              <Collapsible open={item.isOpen} onOpenChange={item.onToggle}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-between text-left font-normal mb-1",
                      item.isOpen && "bg-cyan-50 text-cyan-600",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", item.isOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-4">
                  {item.submenu?.map((subItem) => (
                    <Button
                      key={subItem.id}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start text-left font-normal mb-1 text-sm",
                        activeView === subItem.id && "bg-cyan-500 text-white hover:bg-cyan-600 hover:text-white",
                      )}
                      onClick={() => onViewChange(subItem.id)}
                    >
                      {subItem.label}
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-left font-normal mb-1",
                  activeView === item.id && "bg-cyan-500 text-white hover:bg-cyan-600 hover:text-white",
                )}
                onClick={() => onViewChange(item.id)}
              >
                <item.icon className="h-4 w-4 mr-3" />
                <span>{item.label}</span>
              </Button>
            )}
          </div>
        ))}
      </nav>
    </div>
  )
}
