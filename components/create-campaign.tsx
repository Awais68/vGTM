"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus } from "lucide-react"
import { WorkflowBuilder } from "@/components/workflow-builder"

interface CreateCampaignProps {
  onBack: () => void
}

export function CreateCampaign({ onBack }: CreateCampaignProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [campaignName, setCampaignName] = useState("First Campaign")
  const [selectedList, setSelectedList] = useState("first-test")
  const [selectedSender, setSelectedSender] = useState("john-doe")

  const steps = [
    { number: 1, title: "List of leads", completed: currentStep > 1 },
    { number: 2, title: "LinkedIn senders", completed: currentStep > 2 },
    { number: 3, title: "Sequence", completed: currentStep > 3 },
    { number: 4, title: "Review & Launch", completed: false },
  ]

  const handleContinue = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      onBack()
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Campaign name</label>
              <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="max-w-md" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Select the list of leads you want to reach out to
              </label>
              <Select value={selectedList} onValueChange={setSelectedList}>
                <SelectTrigger className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="first-test">First Test [215 leads]</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" className="w-full max-w-md bg-transparent">
              <Plus className="w-4 h-4 mr-2" />
              Create empty list
            </Button>

            <div className="space-y-4">
              <h3 className="font-medium">Select exclude list</h3>
              <Select>
                <SelectTrigger className="max-w-md">
                  <SelectValue placeholder="Select exclude list" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>

              <div className="space-y-3">
                <h4 className="font-medium">Exclude options</h4>
                <div className="flex items-center space-x-2">
                  <Checkbox id="exclude-contacted" />
                  <label htmlFor="exclude-contacted" className="text-sm">
                    Exclude leads contacted from other campaign
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="exclude-messaged" />
                  <label htmlFor="exclude-messaged" className="text-sm">
                    Exclude leads messaged by other senders
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="exclude-same-sender" />
                  <label htmlFor="exclude-same-sender" className="text-sm">
                    Exclude leads contacted by same sender from other campaign
                  </label>
                </div>
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <p className="text-gray-600">
              Select multiple sending LinkedIn accounts that you want to use in this campaign:
            </p>

            <div className="bg-white border rounded-lg">
              <div className="grid grid-cols-5 gap-4 p-4 border-b bg-gray-50 text-sm font-medium">
                <div>Name</div>
                <div>LinkedIn Subscription</div>
                <div>Activity</div>
                <div>Configure</div>
                <div></div>
              </div>

              <div className="grid grid-cols-5 gap-4 p-4 items-center">
                <div className="flex items-center gap-2">
                  <Checkbox id="john-doe" checked={selectedSender === "john-doe"} />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-white text-sm">
                      JD
                    </div>
                    <div>
                      <div className="font-medium">John Doe</div>
                      <div className="text-sm text-gray-500">up to 40 connections/day</div>
                    </div>
                  </div>
                </div>
                <div>Free Account</div>
                <div>In 0 campaigns.</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    ⚙️
                  </Button>
                  <Button variant="outline" size="sm">
                    ⏰
                  </Button>
                </div>
                <div></div>
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <WorkflowBuilder />
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Review & Launch</h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p>
                <strong>Campaign:</strong> {campaignName}
              </p>
              <p>
                <strong>Leads:</strong> First Test [215 leads]
              </p>
              <p>
                <strong>Sender:</strong> John Doe
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Create Campaign</h1>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-8 mb-8">
        {steps.map((step, index) => (
          <div key={step.number} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step.completed
                  ? "bg-cyan-500 text-white"
                  : currentStep === step.number
                    ? "bg-cyan-500 text-white"
                    : "bg-gray-200 text-gray-600"
              }`}
            >
              {step.completed ? "✓" : step.number}
            </div>
            <span className={`text-sm ${currentStep === step.number ? "text-cyan-600 font-medium" : "text-gray-600"}`}>
              {step.title}
            </span>
            {index < steps.length - 1 && <div className="w-16 h-px bg-gray-300 ml-4"></div>}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg p-6 mb-6">{renderStepContent()}</div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button onClick={handleContinue} className="bg-cyan-500 hover:bg-cyan-600">
          {currentStep === 4 ? "Launch Campaign" : "Continue"}
        </Button>
      </div>
    </div>
  )
}
