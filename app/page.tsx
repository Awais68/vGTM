"use client"

import { useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { CampaignsDashboard } from "@/components/campaigns-dashboard"
import { CreateCampaign } from "@/components/create-campaign"
import { LeadManagement } from "@/components/lead-management"
import { LinkedInAccounts } from "@/components/linkedin-accounts"
import { MyNetwork } from "@/components/my-network"
import { CampaignAnalytics } from "@/components/campaign-analytics"
import { NeedsReview } from "@/components/outreach/NeedsReview"
import { SendQueue } from "@/components/outreach/SendQueue"
import { OverviewDashboard } from "@/components/analytics/OverviewDashboard"
import { WorkspaceSettings } from "@/components/settings/WorkspaceSettings"

function Placeholder({ title }: { title: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">{title}</h1>
      <div className="bg-white rounded-lg border p-8 text-center">
        <p className="text-gray-500">{title} functionality coming soon...</p>
      </div>
    </div>
  )
}

export default function Home() {
  const [activeView, setActiveView] = useState("dashboard")
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)

  const handleViewCampaign = (campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveView("campaign-analytics")
  }

  const handleBackToCampaigns = () => {
    setSelectedCampaign(null)
    setActiveView("campaigns")
  }

  const campaignsView = (
    <CampaignsDashboard
      onCreateCampaign={() => setActiveView("create-campaign")}
      onViewCampaign={handleViewCampaign}
    />
  )

  const renderActiveView = () => {
    switch (activeView) {
      case "dashboard":
        return <OverviewDashboard onOpenQueue={() => setActiveView("send-queue")} />
      case "campaigns":
      case "cold-outreach":
        return campaignsView
      case "create-campaign":
        return <CreateCampaign onBack={() => setActiveView("campaigns")} />
      case "campaign-analytics":
        return <CampaignAnalytics campaignId={selectedCampaign} onBack={handleBackToCampaigns} />
      case "send-queue":
        return <SendQueue />
      case "leads":
        return <LeadManagement />
      case "needs-review":
        return <NeedsReview />
      case "linkedin-accounts":
      case "linkedin":
        return <LinkedInAccounts />
      case "my-network":
        return <MyNetwork />
      case "settings":
        return <WorkspaceSettings />
      case "inbox":
        return <Placeholder title="Inbox" />
      case "ad-data":
        return <Placeholder title="Ad Data" />
      case "seo":
        return <Placeholder title="SEO" />
      case "influencers":
        return <Placeholder title="Influencers" />
      default:
        return <OverviewDashboard onOpenQueue={() => setActiveView("send-queue")} />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 overflow-auto">{renderActiveView()}</main>
      </div>
    </div>
  )
}
