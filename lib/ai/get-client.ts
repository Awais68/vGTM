import { prisma } from '@/lib/prisma'
import { getLanguageModel } from './providers'
import { AIConfig, AIProvider, DEFAULT_MODELS } from './providers'
import { LanguageModel } from 'ai'

export async function getAIModel(workspaceId: string): Promise<LanguageModel> {
  const setting = await prisma.workspaceSetting.findUnique({
    where: { workspaceId },
  })

  if (setting?.aiApiKey) {
    const config: AIConfig = {
      provider: (setting.aiProvider as AIProvider) ?? 'OPENROUTER',
      apiKey: setting.aiApiKey,
      model: setting.aiModel ?? DEFAULT_MODELS[setting.aiProvider as AIProvider],
    }
    return getLanguageModel(config)
  }

  const envProvider = (process.env.AI_PROVIDER as AIProvider) ?? 'OPENROUTER'
  const envKey = process.env.AI_API_KEY

  if (!envKey) {
    throw new Error(
      'No AI API key configured. Go to Admin Panel → Settings → AI Provider to add your key.'
    )
  }

  return getLanguageModel({
    provider: envProvider,
    apiKey: envKey,
    model: process.env.AI_MODEL ?? DEFAULT_MODELS[envProvider],
  })
}
