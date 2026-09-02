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

export default function Home() {
  const [activeView, setActiveView] = useState("campaigns")
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null)

  const handleViewCampaign = (campaignId: string) => {
    setSelectedCampaign(campaignId)
    setActiveView("campaign-analytics")
  }

  const handleBackToCampaigns = () => {
    setSelectedCampaign(null)
    setActiveView("campaigns")
  }

  const renderActiveView = () => {
    switch (activeView) {
      case "dashboard":
        return (
          <CampaignsDashboard
            onCreateCampaign={() => setActiveView("create-campaign")}
            onViewCampaign={handleViewCampaign}
          />
        )
      case "campaigns":
        return (
          <CampaignsDashboard
            onCreateCampaign={() => setActiveView("create-campaign")}
            onViewCampaign={handleViewCampaign}
          />
        )
      case "create-campaign":
        return <CreateCampaign onBack={() => setActiveView("campaigns")} />
      case "campaign-analytics":
        return <CampaignAnalytics onBack={handleBackToCampaigns} />
      case "leads":
        return <LeadManagement />
      case "linkedin-accounts":
        return <LinkedInAccounts />
      case "my-network":
        return <MyNetwork />
      case "cold-outreach":
        return (
          <CampaignsDashboard
            onCreateCampaign={() => setActiveView("create-campaign")}
            onViewCampaign={handleViewCampaign}
          />
        )
      case "linkedin":
        return <LinkedInAccounts />
      case "inbox":
        return (
          <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Inbox</h1>
            <div className="bg-white rounded-lg border p-8 text-center">
              <p className="text-gray-500">Inbox functionality coming soon...</p>
            </div>
          </div>
        )
      case "ad-data":
        return (
          <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Ad Data</h1>
            <div className="bg-white rounded-lg border p-8 text-center">
              <p className="text-gray-500">Ad Data functionality coming soon...</p>
            </div>
          </div>
        )
      case "seo":
        return (
          <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">SEO</h1>
            <div className="bg-white rounded-lg border p-8 text-center">
              <p className="text-gray-500">SEO functionality coming soon...</p>
            </div>
          </div>
        )
      case "influencers":
        return (
          <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Influencers</h1>
            <div className="bg-white rounded-lg border p-8 text-center">
              <p className="text-gray-500">Influencers functionality coming soon...</p>
            </div>
          </div>
        )
      case "settings":
        return (
          <div className="p-6">
            <h1 className="text-2xl font-semibold mb-4">Settings</h1>
            <div className="bg-white rounded-lg border p-8 text-center">
              <p className="text-gray-500">Settings functionality coming soon...</p>
            </div>
          </div>
        )
      default:
        return (
          <CampaignsDashboard
            onCreateCampaign={() => setActiveView("create-campaign")}
            onViewCampaign={handleViewCampaign}
          />
        )
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
