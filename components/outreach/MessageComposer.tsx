"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"

interface Props {
  leadId: string
  messageType: "connection" | "followup" | "proposal"
  stepNumber?: number
  senderName?: string
  context?: string
  onSend?: (message: string) => void
}

export function MessageComposer({
  leadId,
  messageType,
  stepNumber,
  senderName,
  context,
  onSend,
}: Props) {
  const [message, setMessage] = useState("")
  const [generating, setGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const maxChars = messageType === "connection" ? 300 : 500
  const remaining = maxChars - message.length
  const isOverLimit = remaining < 0

  async function handleGenerate() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setGenerating(true)
    setMessage("")
    setHasGenerated(false)

    try {
      const response = await fetch("/api/ai/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          type: messageType,
          stepNumber,
          senderName,
          context,
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error ?? "Failed to generate")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response stream")

      const decoder = new TextDecoder()
      let text = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += decoder.decode(value, { stream: true })
        setMessage(text)
      }

      setHasGenerated(true)
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
      setMessage(
        error instanceof Error ? error.message : "Generation failed"
      )
    } finally {
      setGenerating(false)
      abortRef.current = null
    }
  }

  function handleRegenerate() {
    handleGenerate()
  }

  function handleSend() {
    if (!message.trim() || isOverLimit) return
    onSend?.(message.trim())
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          placeholder={
            messageType === "connection"
              ? "Write a LinkedIn connection note..."
              : messageType === "proposal"
                ? "Write a proposal..."
                : "Write a follow-up message..."
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          className="pr-16 resize-none"
        />
        <div className="absolute bottom-3 right-3">
          <Badge variant={isOverLimit ? "destructive" : "secondary"}>
            {remaining}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Generating...
            </>
          ) : hasGenerated ? (
            "✨ Regenerate"
          ) : (
            "✨ Generate with AI"
          )}
        </Button>

        {message.trim() && !isOverLimit && (
          <Button type="button" size="sm" onClick={handleSend}>
            Send
          </Button>
        )}

        {generating && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              abortRef.current?.abort()
              setGenerating(false)
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
