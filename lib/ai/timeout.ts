/**
 * Every AI call gets a wall-clock budget.
 *
 * Without one, a slow or queued provider (a rate-limited ":free" OpenRouter
 * model, for example) leaves the request hanging until the platform kills it —
 * the user just watches a spinner that never resolves and never errors. A
 * timeout turns that into a normal failure the callers can report or fall back
 * from.
 */
export const AI_TIMEOUT_MS = toPositiveInt(process.env.AI_TIMEOUT_MS, 45_000)

/** Total budget for a multi-call job (document extraction reads N chunks). */
export const AI_JOB_TIMEOUT_MS = toPositiveInt(process.env.AI_JOB_TIMEOUT_MS, 90_000)

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

/**
 * Options to spread into `generateText` / `generateObject` / `streamText`.
 *
 * `maxRetries` is lowered from the SDK default of 2 because a retry multiplies
 * the wait on exactly the provider that was already too slow.
 */
export function aiCallOptions(timeoutMs: number = AI_TIMEOUT_MS) {
  return {
    abortSignal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
    maxRetries: 1,
  }
}

export function isAiTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const name = (error as { name?: string }).name
  if (name === "TimeoutError" || name === "AbortError") return true
  const message = (error as { message?: string }).message ?? ""
  return /aborted|timed? ?out/i.test(message)
}

/** Message worth showing a user, with the timeout case spelled out. */
export function describeAiError(error: unknown): string {
  if (isAiTimeout(error)) {
    return `AI provider did not respond within ${Math.round(AI_TIMEOUT_MS / 1000)}s. Switch to a faster model in Settings → AI Provider, or raise AI_TIMEOUT_MS.`
  }
  return error instanceof Error ? error.message : "AI request failed"
}
