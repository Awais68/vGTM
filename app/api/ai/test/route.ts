import { generateText } from 'ai'
import { getLanguageModel, AIConfig, AIProvider } from '@/lib/ai/providers'
import { NextRequest } from 'next/server'

const bodySchema = {
  provider: 'OPENROUTER' as AIProvider,
  apiKey: '',
  model: '',
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { provider, apiKey, model } = body as {
      provider: AIProvider
      apiKey: string
      model?: string
    }

    if (!apiKey) {
      return Response.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    if (!provider) {
      return Response.json(
        { success: false, error: 'Provider is required' },
        { status: 400 }
      )
    }

    const config: AIConfig = {
      provider,
      apiKey,
      model: model || '',
    }

    const languageModel = getLanguageModel(config)

    const { text } = await generateText({
      model: languageModel,
      prompt: "Say 'vGTM AI is working!' and nothing else.",
    })

    return Response.json({
      success: true,
      response: text.trim(),
      provider,
      model: model || '(default)',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI test failed'
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
