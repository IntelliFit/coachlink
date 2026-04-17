import { BaseService } from '../utils/request'
import type {
  ListLeaderboardItem,
  LeaderboardEntryWithProfile,
  LeaderboardFormInput,
  LeaderboardRule
} from '../types/leaderboard'

interface ListLeaderboardDto {
  page?: number
  limit?: number
  countStatus?: string
}

interface ListLeaderboardRes {
  leaderboards: ListLeaderboardItem[]
  total: number
  page: number
  limit: number
}

interface GetLeaderboardDto {
  id: string
}

interface GetLeaderboardRes {
  leaderboard: {
    id: string
    title: string
    description: string | null
    start_at: string | null
    end_at: string | null
    rank_by_field: string
    sort_order: string | null
    type: string | null
    rules: LeaderboardRule[]
    form_schema: LeaderboardFormInput[]
    remarks: string | null
    created_at: string | null
    creator_id: string | null
    initiator: string | null
    needReview: boolean
  } | null
}

interface ListEntriesDto {
  template_id?: string
  user_id?: string
  status?: string
  page?: number
  limit?: number
  sort_by?: string
}

interface ListEntriesRes {
  entries: LeaderboardEntryWithProfile[]
  total: number
  page: number
  limit: number
}

interface CreateEntryDto {
  template_id: string
  form_data: unknown
  score?: number | null
  evidence_url?: string | null
  status?: string
  user_id?: string
}

interface CreateEntryRes {
  entry: unknown
}

class RankingService extends BaseService {
  async listLeaderboard(params?: ListLeaderboardDto) {
    const res = await this.post<ListLeaderboardRes>('list-leaderboard', params || { page: 1, limit: 10 })
    if (res.success && res.data) return res.data
    return null
  }

  async getLeaderboard(params: GetLeaderboardDto) {
    const res = await this.post<GetLeaderboardRes>('get-leaderboard', params)
    if (res.success && res.data) return res.data
    return null
  }

  async listEntries(params: ListEntriesDto) {
    const res = await this.post<ListEntriesRes>('list-entries', params)
    if (res.success && res.data) return res.data
    return null
  }

  async createEntry(params: CreateEntryDto) {
    const res = await this.post<CreateEntryRes>('create-entry', params)
    if (res.success && res.data) return res.data
    return null
  }
}

export const rankingService = new RankingService('/api/ranking')
