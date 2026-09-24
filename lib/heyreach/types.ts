export interface HeyReachCampaign {
  id: number
  name: string
  status: string
  creationTime: string
  campaignAccountIds: number[]
}

export interface HeyReachLead {
  firstName: string
  lastName?: string
  linkedinUrl: string
  email?: string
  company?: string
  jobTitle?: string
  customFields?: Record<string, string>
}

export interface AddLeadsResult {
  addedLeadsCount: number
  updatedLeadsCount: number
  failedLeadsCount: number
}

export interface CampaignMetrics {
  campaignId: number
  totalLeads: number
  contacted: number
  replied: number
  connected: number
  responseRate: number
  connectionRate: number
}

export interface HeyReachLinkedInAccount {
  id: number
  emailAddress?: string
  firstName?: string
  lastName?: string
  fullName?: string
  profileUrl?: string
  profileImage?: string
  isActive?: boolean
  status?: string
  /** "Free" | "Premium" | "SalesNavigator" | "Recruiter" as HeyReach reports it. */
  accountType?: string
}

export interface HeyReachApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export interface ApiErrorResponse {
  success: false
  error: string
  code: string
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
}
