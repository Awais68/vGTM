import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { LanguageModel } from 'ai'

export type AIProvider = 'OPENROUTER' | 'GEMINI' | 'OPENAI'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
}

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  OPENROUTER: 'google/gemini-flash-1.5',
  GEMINI: 'gemini-1.5-flash',
  OPENAI: 'gpt-4o-mini',
}

export function getLanguageModel(config: AIConfig): LanguageModel {
  switch (config.provider) {
    case 'OPENROUTER': {
      const openrouter = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: config.apiKey,
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
          'X-Title': 'vGTM Outreach',
        },
      })
      return openrouter(config.model || DEFAULT_MODELS.OPENROUTER)
    }

    case 'GEMINI': {
      const google = createGoogleGenerativeAI({ apiKey: config.apiKey })
      return google(config.model || DEFAULT_MODELS.GEMINI)
    }

    case 'OPENAI': {
      const openai = createOpenAI({ apiKey: config.apiKey })
      return openai(config.model || DEFAULT_MODELS.OPENAI)
    }

    default:
      throw new Error(`Unknown AI provider: ${config.provider}`)
  }
}
