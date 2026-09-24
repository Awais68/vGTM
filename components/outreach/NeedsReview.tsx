"use client"

import { useEffect, useState } from "react"
import { LoadErrorState } from "@/components/ui/load-error-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Mail, PauseCircle, PlayCircle } from "lucide-react"

interface ReviewItem {
  enrollmentId: string
  lead: {
    id: string
    firstName: string
    lastName: string | null
    email: string | null
    company: string | null
    status: string
  }
  campaign: { id: string; name: string } | null
  latestMessage: string | null
  updatedAt: string
}

export function NeedsReview() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actingOn, setActingOn] = useState<string | null>(null)

  async function fetchItems() {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch("/api/leads/needs-review")
      const json = await response.json()
      if (json.success) setItems(json.data)
      else setLoadError(json.error ?? "Could not load the review list")
    } catch {
      // "No replies waiting" is a promise to the user; do not make it when
      // the request itself failed.
      setLoadError("Could not load the review list. Check that the database is reachable.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  async function handleAction(leadId: string, action: "resume" | "stop") {
    setActingOn(leadId)
    try {
      await fetch(`/api/leads/${leadId}/resolve-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      setItems((prev) => prev.filter((item) => item.lead.id !== leadId))
    } finally {
      setActingOn(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-semibold">Needs Review</h1>
        <Badge className="bg-amber-100 text-amber-700">{items.length}</Badge>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />
          Loading...
        </div>
      ) : loadError ? (
        <LoadErrorState message={loadError} onRetry={fetchItems} />
      ) : items.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-500">
          No replies waiting on you. Engaged leads and open questions will show up here.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.enrollmentId} className="bg-white rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {item.lead.firstName} {item.lead.lastName ?? ""}
                    {item.lead.company ? <span className="text-gray-500"> · {item.lead.company}</span> : null}
                  </p>
                  <p className="text-sm text-gray-500">
                    {item.lead.email} {item.campaign ? `· ${item.campaign.name}` : ""}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-700">{item.lead.status}</Badge>
              </div>

              {item.latestMessage && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm flex gap-2">
                  <Mail className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                  <p className="whitespace-pre-wrap">{item.latestMessage}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actingOn === item.lead.id}
                  onClick={() => handleAction(item.lead.id, "resume")}
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Resume sequence
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  disabled={actingOn === item.lead.id}
                  onClick={() => handleAction(item.lead.id, "stop")}
                >
                  <PauseCircle className="w-4 h-4 mr-2" />
                  Mark handled & stop
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
