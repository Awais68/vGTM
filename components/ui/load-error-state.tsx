"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface LoadErrorStateProps {
  message: string
  onRetry?: () => void
  /** Set false when rendering inside an already-bordered container (e.g. a table). */
  bordered?: boolean
}

/**
 * Persistent failure state for list views. A toast disappears and leaves the
 * empty-state copy behind, which reads as "you have no data" when the real
 * problem is that the request failed.
 */
export function LoadErrorState({ message, onRetry, bordered = true }: LoadErrorStateProps) {
  return (
    <div
      role="alert"
      className={`p-8 text-center text-gray-600 ${bordered ? "bg-white rounded-lg border" : ""}`}
    >
      <AlertTriangle className="w-5 h-5 text-amber-500 inline-block mr-2 -mt-0.5" />
      <span>{message}</span>
      {onRetry && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
