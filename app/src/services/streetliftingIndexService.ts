/**
 * 街健工具箱 API（与网页端 coachlink 共用后端）
 */
import Taro from '@tarojs/taro'
import { BaseService } from '@/utils/request'

// @ts-ignore
const API_BASE = typeof TARO_APP_API_URL !== 'undefined' ? TARO_APP_API_URL : 'http://localhost:3000'

export interface StreetliftingFormula {
  id: number
  gender: 'Male' | 'Female'
  exercise_type: 'weighted_pullup' | 'weighted_dips'
  coeff_a: number
  coeff_b: number
  coeff_c: number
  coeff_d: number
  coeff_e: number
  coeff_f: number
  total_submissions_used: number
  last_updated: string
}

export interface StreetliftingLocation {
  id: string
  name: string
  description: string | null
  address: string | null
  city: string | null
  province: string | null
  county: string | null
  image_url: string | null
  image_urls: string[] | null
  latitude: number | null
  longitude: number | null
  created_at: string
  user_contact?: string | null
  contributor_user_id?: string | null
  contributor_name_snapshot?: string | null
}

export interface StreetliftingLocationMapPin {
  id: string
  name: string
  latitude: number
  longitude: number
  province?: string | null
  city?: string | null
  county?: string | null
  address?: string | null
}

export interface StreetliftingLocationContributor {
  contributor_key: string
  contributor_user_id: string | null
  display_name: string
  upload_count: number
  detail_score_total: number
  image_count_total: number
  contribution_score: number
  last_contributed_at: string | null
}

export interface StreetliftingStatsTopAreaItem {
  name: string
  count: number
}

export interface StreetliftingStatsMonthlyTrendItem {
  month: string
  count: number
}

export interface StreetliftingLocationOverviewStats {
  totalCount: number
  withImagesCount: number
  withDescriptionCount: number
  averageImageCount: number
  provinceCount: number
  mapReadyCount: number
  contributorCount: number
  topProvinces: StreetliftingStatsTopAreaItem[]
  topCities: StreetliftingStatsTopAreaItem[]
  recentMonths: StreetliftingStatsMonthlyTrendItem[]
}

export interface StreetliftingStatsResponse {
  totalCount: number
  lastUpdated: string | null
  locationOverview: StreetliftingLocationOverviewStats
}

export interface StreetliftingSubmission {
  id: string
  created_at: string
  user_id: string | null
  gender: 'Male' | 'Female'
  bodyweight: number
  added_weight: number
  reps: number
  form_quality: 'Competition' | 'Minor_Cheat' | 'Major_Cheat' | 'Extreme_Cheat'
  penalty_weight: number
  user_name: string | null
  video_url: string | null
  pullup_type: 'Overhand' | 'Underhand' | null
  exercise_type: 'weighted_pullup' | 'weighted_dips'
}

class StreetliftingIndexService extends BaseService {
  constructor() {
    super('/api/streetlifting-index')
  }

  async listFormulas() {
    const res = await this.post<{ formulas: StreetliftingFormula[] }>('formulas/list', {})
    if (res.success && res.data?.formulas) {
      return res.data
    }
    throw new Error((res as any)?.message || '获取公式失败')
  }

  async listLocations(params?: { page?: number; limit?: number; search?: string; province?: string; city?: string; county?: string }) {
    const res = await this.post<{
      locations: StreetliftingLocation[]
      pagination: { page: number; limit: number; total: number }
      provinces: string[]
    }>('locations/list', params || {})
    if (res.success && res.data) return res.data
    throw new Error((res as any)?.message || '加载失败')
  }

  async createLocation(dto: {
    name: string
    description?: string | null
    address?: string | null
    city?: string | null
    province?: string | null
    county?: string | null
    latitude?: number | null
    longitude?: number | null
    image_urls?: string[] | null
    user_contact?: string | null
  }) {
    const res = await this.post<{ location: StreetliftingLocation }>('locations/create', dto)
    if (res.success && res.data?.location) return res.data
    throw new Error((res as any)?.message || '提交失败')
  }

  async updateLocation(dto: {
    id: string
    name?: string
    description?: string | null
    address?: string | null
    city?: string | null
    province?: string | null
    county?: string | null
    latitude?: number | null
    longitude?: number | null
    image_urls?: string[] | null
    user_contact?: string | null
  }) {
    const res = await this.post<{ location: StreetliftingLocation }>('locations/update', dto)
    if (res.success && res.data?.location) return res.data
    throw new Error((res as any)?.message || '保存失败')
  }

  async listLocationMapPins() {
    const res = await this.post<StreetliftingLocationMapPin[]>('locations/map-pins', {})
    if (res.success && res.data) return res.data
    throw new Error((res as any)?.message || '地图点位加载失败')
  }

  async listLocationContributors(params?: { limit?: number }) {
    const res = await this.post<{ contributors: StreetliftingLocationContributor[] }>('locations/contributors', params || {})
    if (res.success && res.data) return res.data
    throw new Error((res as any)?.message || '贡献榜加载失败')
  }

  async getStats() {
    const res = await this.post<StreetliftingStatsResponse>('stats', {})
    if (res.success && res.data) return res.data
    throw new Error((res as any)?.message || '统计加载失败')
  }

  /** 上传地点图片，filePath 为 Taro.chooseImage 返回的 tempFilePath */
  async uploadLocationImage(filePath: string): Promise<{ url: string } | null> {
    const token = Taro.getStorageSync('token') || ''
    return new Promise((resolve, reject) => {
      Taro.uploadFile({
        url: `${API_BASE}/api/streetlifting-index/upload-location-image`,
        filePath,
        name: 'file',
        header: { Authorization: token ? `Bearer ${token}` : '' },
        success: (uploadRes: any) => {
          try {
            const data = JSON.parse(uploadRes.data || '{}')
            if (data?.success && data?.data?.url) resolve(data.data)
            else reject(new Error(data?.message || '上传失败'))
          } catch (e) {
            reject(e)
          }
        },
        fail: (err: any) => reject(new Error(err?.errMsg || '上传失败'))
      })
    })
  }

  async listSubmissions(params?: { limit?: number; order?: 'asc' | 'desc'; sort_by?: string }) {
    const res = await this.post<{ submissions: StreetliftingSubmission[] }>('submissions/list', params || {})
    if (res.success && res.data) return res.data
    throw new Error((res as any)?.message || '加载失败')
  }

  async createSubmission(dto: {
    gender: 'Male' | 'Female'
    bodyweight: number
    added_weight: number
    reps: number
    form_quality: string
    penalty_weight?: number
    user_name?: string | null
    video_url?: string | null
    pullup_type?: 'Overhand' | 'Underhand' | null
    exercise_type: 'weighted_pullup' | 'weighted_dips'
  }) {
    const res = await this.post<{ submission: StreetliftingSubmission }>('submissions/create', dto)
    if (res.success && res.data?.submission) return res.data
    throw new Error((res as any)?.message || '提交失败')
  }

  async claimSubmission(submissionId: string) {
    const res = await this.post<{ submission: StreetliftingSubmission }>('submissions/claim', {
      submission_id: submissionId
    })
    if (res.success && res.data?.submission) return res.data
    throw new Error((res as any)?.message || '认领失败')
  }

  async checkExistingSubmission(): Promise<{
    hasExisting: boolean
    existingSubmission?: {
      id: string
      created_at: string
      exercise_type: string
      bodyweight: number
      added_weight: number
      reps: number
    } | null
  } | null> {
    const res = await this.post<{
      hasExisting: boolean
      existingSubmission?: {
        id: string
        created_at: string
        exercise_type: string
        bodyweight: number
        added_weight: number
        reps: number
      } | null
    }>('submissions/check-existing', {})
    if (res.success && res.data) return res.data
    return null
  }
}

export const streetliftingIndexService = new StreetliftingIndexService()
