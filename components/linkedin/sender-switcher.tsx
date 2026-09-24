"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Linkedin } from "lucide-react"
import { useSenderAccounts } from "./sender-context"

/**
 * Header control for switching the LinkedIn profile the operator is working as.
 * The choice is remembered per browser and drives the Send Queue filter.
 */
export function SenderSwitcher({ onManage }: { onManage?: () => void }) {
  const { accounts, activeAccountId, setActiveAccountId, loading } = useSenderAccounts()

  if (loading) return null

  if (accounts.length === 0) {
    return (
      <button
        type="button"
        onClick={onManage}
        className="flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
      >
        <Linkedin className="h-4 w-4" />
        Add a sender
      </button>
    )
  }

  return (
    <Select value={activeAccountId ?? ""} onValueChange={setActiveAccountId}>
      <SelectTrigger className="w-56 border-white/20 bg-white/10 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <Linkedin className="h-4 w-4 flex-shrink-0" />
          <SelectValue placeholder="Choose a sender" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => {
          const used = account.usage.connection.sentToday + account.usage.message.sentToday
          const cap = account.usage.connection.limit + account.usage.message.limit
          return (
            <SelectItem key={account.id} value={account.id}>
              <span className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    account.status === "ACTIVE"
                      ? account.withinWorkingHours
                        ? "bg-green-500"
                        : "bg-amber-400"
                      : "bg-gray-300"
                  }`}
                />
                {account.name}
                <span className="text-xs text-gray-400">
                  {used}/{cap}
                </span>
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}
