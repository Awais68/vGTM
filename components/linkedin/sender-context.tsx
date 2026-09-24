"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

export interface SenderUsage {
  sentToday: number
  limit: number
  pending: number
}

export interface SenderAccount {
  id: string
  name: string
  email: string | null
  profileUrl: string | null
  avatarUrl: string | null
  subscription: "FREE" | "PREMIUM" | "SALES_NAVIGATOR" | "RECRUITER"
  provider: "MANUAL" | "HEYREACH"
  heyreachAccountId: string | null
  status: "ACTIVE" | "PAUSED" | "DISCONNECTED" | "NEEDS_ATTENTION"
  isDefault: boolean
  timezone: string
  dailyConnectionLimit: number
  dailyMessageLimit: number
  dailyInMailLimit: number
  dailyProfileViewLimit: number
  warmupEnabled: boolean
  warmupDays: number
  warmupStartAt: string | null
  workingHours: unknown
  lastSyncedAt: string | null
  lastError: string | null
  campaignCount: number
  warmupProgress: number
  withinWorkingHours: boolean
  usage: { connection: SenderUsage; message: SenderUsage }
}

interface SenderContextValue {
  accounts: SenderAccount[]
  activeAccount: SenderAccount | null
  activeAccountId: string | null
  loading: boolean
  error: string | null
  setActiveAccountId: (id: string | null) => void
  refresh: () => Promise<void>
}

const STORAGE_KEY = "vgtm.activeSenderAccount"

const SenderContext = createContext<SenderContextValue | null>(null)

export function SenderProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<SenderAccount[]>([])
  const [activeAccountId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/linkedin-accounts")
      const json = await response.json()

      if (!response.ok || !json.success) {
        setError(json.error ?? "Could not load LinkedIn accounts")
        return
      }

      const list = json.data as SenderAccount[]
      setError(null)
      setAccounts(list)

      // Keep whatever the operator picked last, as long as it still exists.
      setActiveId((current) => {
        if (current && list.some((a) => a.id === current)) return current
        const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
        if (stored && list.some((a) => a.id === stored)) return stored
        return list.find((a) => a.isDefault)?.id ?? list[0]?.id ?? null
      })
    } catch {
      setError("Network error while loading LinkedIn accounts")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setActiveAccountId = useCallback((id: string | null) => {
    setActiveId(id)
    if (typeof window === "undefined") return
    if (id) window.localStorage.setItem(STORAGE_KEY, id)
    else window.localStorage.removeItem(STORAGE_KEY)
  }, [])

  const value = useMemo<SenderContextValue>(
    () => ({
      accounts,
      activeAccountId,
      activeAccount: accounts.find((a) => a.id === activeAccountId) ?? null,
      loading,
      error,
      setActiveAccountId,
      refresh,
    }),
    [accounts, activeAccountId, loading, error, setActiveAccountId, refresh]
  )

  return <SenderContext.Provider value={value}>{children}</SenderContext.Provider>
}

export function useSenderAccounts(): SenderContextValue {
  const context = useContext(SenderContext)
  if (!context) {
    throw new Error("useSenderAccounts must be used inside a SenderProvider")
  }
  return context
}
