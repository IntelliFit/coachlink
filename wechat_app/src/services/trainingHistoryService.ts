import { request } from '../utils/request'

export interface TrainingCalendarDay {
  date: string
  sessions: number
}

export interface GetCalendarResponse {
  days: TrainingCalendarDay[]
}

export interface TrainingDayHistoryItem {
  id: string
  sourceType: 'IMPROMPTU' | 'SELF_PLAN' | 'COACH_PLAN'
  status: string
  startedAt: string
  completedAt: string | null
  totalSets: number
  completedSets: number
  title: string
  actionSummaries?: Array<{
    actionName: string
    completedSets: number
    totalSets: number
  }>
}

export interface GetDayHistoryResponse {
  date: string
  items: TrainingDayHistoryItem[]
}

export interface GetMonthShareResponse {
  month: string
  totalSessions: number
  trainingDays: number
  totalSets: number
  sourceBreakdown: {
    impromptu: number
    selfPlan: number
    coachPlan: number
  }
}

class TrainingHistoryService {
  private readonly baseUrl = '/api/training-history'

  async getCalendar(month: string): Promise<GetCalendarResponse | null> {
    const res = await request({
      url: `${this.baseUrl}/calendar`,
      method: 'POST',
      data: { month }
    })
    if (res.success && res.data) return res.data as GetCalendarResponse
    return null
  }

  async getDayHistory(date: string): Promise<GetDayHistoryResponse | null> {
    const res = await request({
      url: `${this.baseUrl}/day`,
      method: 'POST',
      data: { date }
    })
    if (res.success && res.data) return res.data as GetDayHistoryResponse
    return null
  }

  async getMonthShare(month: string): Promise<GetMonthShareResponse | null> {
    const res = await request({
      url: `${this.baseUrl}/month-share`,
      method: 'POST',
      data: { month }
    })
    if (res.success && res.data) return res.data as GetMonthShareResponse
    return null
  }
}

export const trainingHistoryService = new TrainingHistoryService()
