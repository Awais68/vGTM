import type {
  HeyReachCampaign,
  HeyReachLead,
  AddLeadsResult,
  CampaignMetrics,
} from "./types"

const BASE_URL = "https://api.heyreach.io/api/public"
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

export class HeyReachAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HeyReachAuthError"
  }
}

export class HeyReachRateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "HeyReachRateLimitError"
  }
}

export class HeyReachApiError extends Error {
  public statusCode: number
  public body: unknown

  constructor(message: string, statusCode: number, body: unknown) {
    super(message)
    this.name = "HeyReachApiError"
    this.statusCode = statusCode
    this.body = body
  }
}

export class HeyReachClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": this.apiKey,
          ...options?.headers,
        },
      })

      if (response.status === 401 || response.status === 403) {
        throw new HeyReachAuthError(
          "Invalid or expired HeyReach API key. Update it in Admin Panel."
        )
      }

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
          await new Promise((resolve) => setTimeout(resolve, backoffMs))
          continue
        }
        throw new HeyReachRateLimitError(
          "HeyReach API rate limit exceeded. Try again later."
        )
      }

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new HeyReachApiError(
          `HeyReach API returned status ${response.status}`,
          response.status,
          body
        )
      }

      return response.json() as Promise<T>
    }

    throw new HeyReachApiError("Max retries exceeded", 429, null)
  }

  async verifyApiKey(): Promise<boolean> {
    try {
      await this.request<unknown>("/auth/CheckApiKey")
      return true
    } catch (error) {
      if (error instanceof HeyReachAuthError) return false
      throw error
    }
  }

  async getAllCampaigns(
    offset = 0,
    limit = 50
  ): Promise<HeyReachCampaign[]> {
    const response = await this.request<{
      data: HeyReachCampaign[]
    }>(`/campaign/GetAllCampaigns?offset=${offset}&limit=${limit}`)
    return response.data
  }

  async getCampaignById(
    campaignId: number
  ): Promise<HeyReachCampaign> {
    const response = await this.request<{ data: HeyReachCampaign }>(
      `/campaign/GetCampaignById?campaignId=${campaignId}`
    )
    return response.data
  }

  async pauseOrResumeCampaign(
    campaignId: number
  ): Promise<void> {
    await this.request<unknown>("/campaign/PauseOrResumeCampaign", {
      method: "POST",
      body: JSON.stringify({ campaignId }),
    })
  }

  async addLeadsToCampaign(
    campaignId: number,
    leads: HeyReachLead[]
  ): Promise<AddLeadsResult> {
    const response = await this.request<{ data: AddLeadsResult }>(
      "/lead/AddLeadsToCampaign",
      {
        method: "POST",
        body: JSON.stringify({ campaignId, leads }),
      }
    )
    return response.data
  }

  async getLeadsFromCampaign(
    campaignId: number,
    offset = 0,
    limit = 50
  ): Promise<HeyReachLead[]> {
    const response = await this.request<{ data: HeyReachLead[] }>(
      `/lead/GetLeadsFromCampaign?campaignId=${campaignId}&offset=${offset}&limit=${limit}`
    )
    return response.data
  }

  async sendDirectMessage(
    leadId: string,
    message: string
  ): Promise<void> {
    await this.request<unknown>("/message/SendDirectMessage", {
      method: "POST",
      body: JSON.stringify({ leadId, message }),
    })
  }

  async getCampaignMetrics(
    campaignId: number
  ): Promise<CampaignMetrics> {
    const response = await this.request<{ data: CampaignMetrics }>(
      `/campaign/GetCampaignMetrics?campaignId=${campaignId}`
    )
    return response.data
  }
}
