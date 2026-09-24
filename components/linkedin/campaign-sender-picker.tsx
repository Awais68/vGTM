"use client"

import { useEffect, useState } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { useSenderAccounts } from "./sender-context"

const PLAN_LABELS: Record<string, string> = {
  FREE: "Free account",
  PREMIUM: "Premium",
  SALES_NAVIGATOR: "Sales Navigator",
  RECRUITER: "Recruiter",
}

/** Attaches LinkedIn senders to a campaign. Empty selection = any active sender. */
export function CampaignSenderPicker({ campaignId }: { campaignId: string }) {
  const { accounts, loading } = useSenderAccounts()
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}/senders`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setSelected(json.data)
      })
      .catch(() => undefined)
  }, [campaignId])

  const persist = async (accountIds: string[]) => {
    setSelected(accountIds)
    setSaving(true)
    try {
      await fetch(`/api/campaigns/${campaignId}/senders`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds }),
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading senders…
      </p>
    )
  }

  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
        No sender accounts yet. Add one under LinkedIn → LinkedIn Accounts.
      </p>
    )
  }

  return (
    <div className="rounded-lg border bg-white">
      {accounts.map((account) => (
        <label
          key={account.id}
          className="flex cursor-pointer items-center justify-between gap-4 border-b p-4 last:border-b-0"
        >
          <div className="flex items-center gap-3">
            <Checkbox
              checked={selected.includes(account.id)}
              onCheckedChange={(checked) =>
                persist(
                  checked === true
                    ? [...selected, account.id]
                    : selected.filter((id) => id !== account.id)
                )
              }
            />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-sm text-white">
              {account.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{account.name}</div>
              <div className="text-sm text-gray-500">
                up to {account.usage.connection.limit} connections/day ·{" "}
                {account.usage.message.limit} messages/day
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Badge variant="outline">{PLAN_LABELS[account.subscription] ?? account.subscription}</Badge>
            <span>In {account.campaignCount} campaign(s)</span>
          </div>
        </label>
      ))}
      {saving && <p className="p-2 text-xs text-gray-400">Saving…</p>}
    </div>
  )
}
