import Taro from '@tarojs/taro'
import { API_BASE_URL, BaseService, request } from '../utils/request'

interface UpdateProfileDto {
  nickname?: string
  avatar_url?: string | null
  age?: number | null
  gender?: string
  height?: number | null
  weight?: number | null
  lifestyle?: string
  fitness_goal?: string
  fitness_level?: string
  sport_cards?: any
  onboarding_completed?: boolean
}

interface SubmitOnboardingDto {
  userId?: string
  coachId?: string
  answers: Record<string, any>
  baseline_video_urls?: string[]
}

interface GetStudentProfileResponseDto {
  profile: any
  questionnaire: any
  videos: any[]
  lifestyle: any[]
}

interface GetStudentStatsResponseDto {
  subscriptionCount: number
  activePlanCount: number
  completedWorkouts: number
}

interface DeleteAccountDto {
  confirmationText: string
}

interface GetE1RMHistoryDto {
  actionId?: string
  actionName?: string
  targetUserId?: string
  startDate?: string
  endDate?: string
  limit?: number
}

class StudentService extends BaseService {
  /**
   * 获取学员档案
   */
  async getStudentProfile(userId?: string) {
    const res = await this.post<GetStudentProfileResponseDto>('get-student-profile', userId ? { userId } : {})
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  /**
   * 更新个人档案
   */
  async updateProfile(data: UpdateProfileDto) {
    const res = await this.post('update-profile', data)
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  async uploadAvatar(filePath: string) {
    const token = String(Taro.getStorageSync('token') || '').trim()
    if (!token) {
      throw new Error('请先登录后再上传头像')
    }

    const response = await Taro.uploadFile({
      url: `${API_BASE_URL}/api/upload/avatar`,
      filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
      },
    })

    const result = JSON.parse(response.data || '{}') as {
      success?: boolean
      message?: string
      data?: { url?: string }
    }

    if (response.statusCode !== 200 || !result.success || !result.data?.url) {
      throw new Error(result.message || '头像上传失败')
    }

    return result.data.url
  }

  async submitOnboarding(data: SubmitOnboardingDto) {
    const res = await this.post('submit-onboarding', data)

    if (res.success && res.data) {
      return res.data
    }

    return null
  }

  /**
   * 获取E1RM历史数据
   */
  async getE1RMHistory(params?: string | GetE1RMHistoryDto) {
    const payload =
      typeof params === 'string'
        ? { actionId: params }
        : (params || {})

    // 历史原因：该接口位于 /api/student，而非 /api/user
    const res = await request({
      url: '/api/student/get-e1rm-history',
      method: 'POST',
      data: payload,
      showErrorToast: false
    })
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  /**
   * 获取当前1RM数据
   */
  async getCurrent1RM(targetUserId?: string) {
    // 历史原因：该接口位于 /api/student，而非 /api/user
    const res = await request({
      url: '/api/student/get-current-1rm',
      method: 'POST',
      data: targetUserId ? { targetUserId, preferPR: true } : { preferPR: true },
      showErrorToast: false
    })
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  async getStudentStats() {
    const res = await this.post<GetStudentStatsResponseDto>('get-student-stats', {})
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  async deleteAccount(data: DeleteAccountDto) {
    const res = await this.post('delete-account', data)
    if (res.success) {
      return res.data ?? true
    }
    throw new Error(res.message || '注销账号失败')
  }

  async getVisibilityStatus() {
    const res = await request({
      url: '/api/student/visibility-status',
      method: 'GET',
      showErrorToast: false
    })
    if (res.success && res.data) {
      return res.data
    }
    return null
  }
}

export const studentService = new StudentService('/api/user')
