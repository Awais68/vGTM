"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react"
import { LeadImporter } from "@/components/leads/LeadImporter"
import { CampaignSenderPicker } from "@/components/linkedin/campaign-sender-picker"

interface CreateCampaignProps {
  onBack: () => void
}

interface EmailStep {
  stepNumber: number
  type: "EMAIL" | "FOLLOW_UP"
  subject: string
  template: string
  delayDays: number
}

function newStep(stepNumber: number): EmailStep {
  return {
    stepNumber,
    type: stepNumber === 1 ? "EMAIL" : "FOLLOW_UP",
    subject: "",
    template: "",
    delayDays: stepNumber === 1 ? 0 : 3,
  }
}

export function CreateCampaign({ onBack }: CreateCampaignProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [campaignName, setCampaignName] = useState("First Campaign")
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [leadCount, setLeadCount] = useState(0)
  const [emailSteps, setEmailSteps] = useState<EmailStep[]>([newStep(1)])
  const [saving, setSaving] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [launched, setLaunched] = useState(false)

  const steps = [
    { number: 1, title: "Campaign & leads", completed: currentStep > 1 },
    { number: 2, title: "LinkedIn senders", completed: currentStep > 2 },
    { number: 3, title: "Sequence", completed: currentStep > 3 },
    { number: 4, title: "Review & Launch", completed: false },
  ]

  async function ensureCampaign(): Promise<string | null> {
    if (campaignId) return campaignId
    setError(null)
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: campaignName }),
      })
      const json = await response.json()
      if (!json.success) {
        setError(json.error ?? "Failed to create campaign")
        return null
      }
      setCampaignId(json.data.id)
      return json.data.id
    } catch {
      setError("Network error while creating campaign")
      return null
    }
  }

  async function saveSequence(id: string): Promise<boolean> {
    const validSteps = emailSteps.filter((s) => s.template.trim().length > 0)
    if (validSteps.length === 0) return true
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/campaigns/${id}/sequence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Email Sequence",
          steps: validSteps.map((s, i) => ({ ...s, stepNumber: i + 1 })),
        }),
      })
      const json = await response.json()
      if (!json.success) {
        setError(json.error ?? "Failed to save sequence")
        return false
      }
      return true
    } catch {
      setError("Network error while saving sequence")
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleContinue = async () => {
    if (currentStep === 1) {
      const id = await ensureCampaign()
      if (!id) return
    }
    if (currentStep === 3) {
      if (!campaignId) return
      const ok = await saveSequence(campaignId)
      if (!ok) return
    }
    if (currentStep === 4) {
      await handleLaunch()
      return
    }
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1)
    }
  }

  async function handleLaunch() {
    if (!campaignId) return
    setLaunching(true)
    setError(null)
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/launch`, { method: "POST" })
      const json = await response.json()
      if (!json.success) {
        setError(json.error ?? "Failed to launch campaign")
        return
      }
      setLaunched(true)
    } catch {
      setError("Network error while launching campaign")
    } finally {
      setLaunching(false)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    } else {
      onBack()
    }
  }

  function updateStep(index: number, patch: Partial<EmailStep>) {
    setEmailSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function addStep() {
    setEmailSteps((prev) => [...prev, newStep(prev.length + 1)])
  }

  function removeStep(index: number) {
    setEmailSteps((prev) => prev.filter((_, i) => i !== index))
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Campaign name</label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                disabled={!!campaignId}
                className="max-w-md"
              />
            </div>

            {campaignId ? (
              <LeadImporter
                campaignId={campaignId}
                onImported={(results) => setLeadCount((c) => c + results.imported + results.updated)}
              />
            ) : (
              <p className="text-sm text-gray-500">
                Continue to create the campaign, then import your leads CSV.
              </p>
            )}
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <p className="text-gray-600">
              Choose the LinkedIn profiles this campaign sends from. Drafts rotate across whichever
              senders still have headroom. Leave everything unchecked to use any active sender.
            </p>

            {campaignId ? (
              <CampaignSenderPicker campaignId={campaignId} />
            ) : (
              <p className="text-sm text-gray-500">Create the campaign first, then pick its senders.</p>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <p className="text-gray-600">
              Define the email sequence. Each step sends automatically after the previous one, using merge tags
              like <code>{"{{firstName}}"}</code>, <code>{"{{company}}"}</code>, <code>{"{{jobTitle}}"}</code>.
            </p>

            {emailSteps.map((step, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">
                    {index === 0 ? "Initial email" : `Follow-up ${index}`}
                  </h4>
                  {emailSteps.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeStep(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Subject</label>
                  <Input
                    value={step.subject}
                    onChange={(e) => updateStep(index, { subject: e.target.value })}
                    placeholder="Quick question, {{firstName}}"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Body</label>
                  <Textarea
                    value={step.template}
                    onChange={(e) => updateStep(index, { template: e.target.value })}
                    rows={5}
                    placeholder={"Hi {{firstName}},\n\n..."}
                  />
                </div>

                {index > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Send after (days)</label>
                    <Input
                      type="number"
                      min={0}
                      value={step.delayDays}
                      onChange={(e) => updateStep(index, { delayDays: Number(e.target.value) })}
                      className="max-w-[120px]"
                    />
                  </div>
                )}
              </div>
            ))}

            <Button variant="outline" onClick={addStep}>
              <Plus className="w-4 h-4 mr-2" />
              Add follow-up step
            </Button>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Review & Launch</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-1">
              <p>
                <strong>Campaign:</strong> {campaignName}
              </p>
              <p>
                <strong>Leads imported:</strong> {leadCount}
              </p>
              <p>
                <strong>Email steps:</strong> {emailSteps.filter((s) => s.template.trim()).length}
              </p>
            </div>
            {launched && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                Campaign launched. Emails will start sending automatically on schedule.
              </p>
            )}
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

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={saving || launching}>
          Back
        </Button>
        <Button onClick={handleContinue} disabled={saving || launching || launched} className="bg-cyan-500 hover:bg-cyan-600">
          {(saving || launching) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {launched ? "Launched" : currentStep === 4 ? "Launch Campaign" : "Continue"}
        </Button>
      </div>
    </div>
  )
}
