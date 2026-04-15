import { BaseService } from '../../utils/request'
import Taro from '@tarojs/taro'

interface GetAllCoachesDto {
  page?: number
  limit?: number
  search?: string
  specialty?: string
}

interface GetAllCoachesResponseDto {
  coaches: any[]
  count: number
  pagination: {
    page: number
    limit: number
  }
}

interface GetCoachDto {
  id?: string
  userId?: string
}

interface GetCoachResponseDto {
  coach: any
}

interface GetSpecialtiesResponseDto {
  specialties: Array<{
    id: string
    name: string
  }>
}

class CoachService extends BaseService {
  /**
   * 获取所有教练列表
   */
  async getAllCoaches(reqData: GetAllCoachesDto) {
    const res = await this.post<GetAllCoachesResponseDto>('get-all-coaches', reqData)
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  /**
   * 获取单个教练信息
   */
  async getCoach(reqData: GetCoachDto) {
    const res = await this.post<GetCoachResponseDto>('get-coach', reqData)
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  /**
   * 获取所有专长列表
   */
  async getAllSpecialties() {
    const res = await this.post<GetSpecialtiesResponseDto>('get-specialties', {})
    
    if (res.success && res.data) {
      return res.data.specialties
    }
    
    return null
  }

  /**
   * 获取教练的问卷配置
   */
  async getQuestionnaires(reqData?: { coachId?: string }) {
    const res = await this.post('get-questionnaires', reqData || {})
    
    if (res.success && res.data) {
      return res.data
    }
    
    return null
  }

  /**
   * 获取教练概览数据（dashboard overview）
   */
  async getOverviewData() {
    const res = await this.post<{
      totalStudentCount: number
      pendingReviewCount: number
      averageRating: number
      monthlyRevenue: number
      contentCount: number
      actionCount: number
      planTemplateCount: number
      questionReady: boolean
      pricingReady: boolean
    }>('get-overview-data', {})
    if (res.success && res.data) return res.data
    return null
  }

  /** 学员列表 */
  async listStudents(params?: {
    pagination?: { page: number; limit: number }
    search?: string
    sort?: {
      mode: 'subscription_created_desc' | 'subscription_created_asc' | 'subscription_updated_desc'
    }
  }) {
    const res = await this.post<{
      students: any[]
      total?: number
      pagination?: { page: number; limit: number; total: number }
    }>('list-students', {
      pagination: params?.pagination || { page: 0, limit: 20 },
      search: params?.search || '',
      sort: params?.sort
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 待支付确认列表（教练端） */
  async getPaymentWaitingStudents() {
    const res = await this.post<{
      manualSubscriptions: any[]
      systemSubscriptions: any[]
    }>('get-payment-waiting-students', {})
    if (res.success && res.data) return res.data
    return null
  }

  /** 支付确认历史（教练端） */
  async getPaymentConfirmationHistory(params?: { limit?: number }) {
    const res = await this.post<{
      subscriptions: any[]
    }>('get-payment-confirmation-history', {
      limit: params?.limit ?? 50
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 学员详情 */
  async getStudent(params: { subscriptionId?: string; studentId?: string; need1RM?: boolean }) {
    const res = await this.post<{ student: any }>('get-student', params)
    if (res.success && res.data) return res.data
    return null
  }

  /** 学员动作库（教练视角） */
  async getStudentActions(params: { subscriptionId: string }) {
    const res = await this.post<{ actions: any[] }>('get-student-actions', params)
    if (res.success && res.data) return res.data
    return null
  }

  /** 学员反馈（按计划实例） */
  async getStudentFeedbacks(params: { instanceId: string; markRead?: boolean }) {
    const res = await this.post<{ feedbacks: any[]; unread_count: number }>('get-student-feedbacks', params)
    if (res.success && res.data) return res.data
    return null
  }

  /** 批量更新学员动作 1RM */
  async batchUpdateStudent1RM(params: {
    subscriptionId: string
    updates: Array<{ actionId: string; reference_1rm: number | null }>
  }) {
    const res = await this.post<{ updated: number }>('batch-update-student-1rm', params)
    if (res.success && res.data) return res.data
    return null
  }

  /** 教练发布的内容列表（需传 coachId，可用 getCoach 获取） */
  async getContents(params: { coachId: string; limit?: number; offset?: number; content_type?: string; required_tier?: number }) {
    const res = await this.post<{ contents: any[]; total: number }>('get-contents', {
      coachId: params.coachId,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0,
      content_type: params.content_type,
      required_tier: params.required_tier
    })
    if (res.success && res.data) return res.data
    return null
  }

  /** 单条内容详情 */
  async getContentById(params: { contentId: string }) {
    const res = await this.post<{ content: any; accessTier: number }>('get-content-by-id', params)
    if (res.success && res.data) return res.data
    return null
  }

  /** 订阅/定价：传入 coachId（学员查看某教练）或 userId（教练查看自己的） */
  async getPricing(reqData?: { coachId?: string; userId?: string }) {
    const res = await this.post<{ pricings?: any[]; products?: any[] }>('get-pricing', reqData || {})
    if (res.success && res.data) return res.data
    return null
  }

  /** 更新定价 */
  async updatePricing(reqData: { products?: any[]; pricings?: any[] }) {
    const res = await this.post<{ pricing: any }>('update-pricing', reqData)
    if (res.success && res.data) return res.data
    return null
  }

  /** 收入明细（month 格式 2026-01，默认当月） */
  async getRevenueDetails(params?: { month?: string }) {
    const res = await this.post<{
      items: any[]
      subscriptionRevenue: number
      contentPurchaseRevenue: number
      totalRevenue: number
    }>('get-revenue-details', params || {})
    if (res.success && res.data) return res.data
    return null
  }

  /** 发布内容 */
  async publishContent(reqData: {
    coachId: string
    title: string
    content: string
    content_type?: string
    required_tier?: number
    price_cents?: number
    is_featured?: boolean
    tags?: string[]
    media_urls?: string[]
    thumbnail_url?: string
    isDraft?: boolean
  }) {
    const res = await this.post<{ success: boolean; message?: string }>('publish-content', reqData)
    return res
  }

  /** 更新内容 */
  async updateContent(reqData: {
    id: string
    title?: string
    content?: string
    content_type?: string
    required_tier?: number
    price_cents?: number
    is_featured?: boolean
    tags?: string[]
    media_urls?: string[]
    thumbnail_url?: string
    isDraft?: boolean
  }) {
    const res = await this.post<{ success: boolean; message?: string }>('update-content', reqData)
    return res
  }

  /** 删除内容 */
  async deleteContent(contentId: string) {
    const res = await this.post<{ success: boolean; message?: string }>('delete-content', { id: contentId })
    return res
  }

  /** 更新问卷（id为空时创建新问卷） */
  async updateQuestionnaires(reqData: {
    coachId: string
    questionnaires: any[]
    id?: string
    mode?: 'online' | 'draft'
  }) {
    const res = await this.post<{ success: boolean; message?: string; data?: { id: string } }>('update-questionnaires', reqData)
    return res
  }

  /** 发布草稿问卷到线上 */
  async publishQuestionnaire(reqData: { id: string }) {
    const res = await this.post<{ success: boolean; message?: string; data?: { id: string } }>('publish-questionnaire', reqData)
    return res
  }

  /** 复制问卷（用于从线上复制到草稿） */
  async duplicateQuestionnaire(reqData: { id: string }) {
    const res = await this.post<{ success: boolean; message?: string; data?: { id: string } }>('duplicate-questionnaire', reqData)
    return res
  }

  /** 设置默认问卷 */
  async setDefaultQuestionnaire(reqData: { id: string }) {
    const res = await this.post<{ success: boolean; message?: string; data?: { id: string } }>('set-default-questionnaire', reqData)
    return res
  }

  /** 获取问卷模板列表 */
  async listQuestionnaires(reqData?: { coachId?: string }) {
    const res = await this.post<{ 
      items: Array<{
        id: string
        name: string
        is_active: boolean
        version: number | null
        created_at: string | null
        updated_at: string | null
        is_default: boolean
      }>
      defaultId: string | null
    }>('list-questionnaires', reqData || {})
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /** 根据ID获取问卷详情 */
  async getQuestionnaireById(reqData: { id: string }) {
    const res = await this.post('get-questionnaire-by-id', reqData)
    if (res.success && res.data) {
      return res.data
    }
    return null
  }

  /** 钱包信息（POST） */
  async getWallet() {
    const res = await this.post<{ 
      balance: number
      total_income?: number
      frozen_amount?: number
      transactions?: Array<{
        id: string
        amount: number
        type: 'income' | 'withdrawal' | 'refund'
        description: string
        created_at: string
        subject?: string | null
        order_type?: string | null
        student_id?: string | null
        student_name?: string | null
        alipay_order_id?: string | null
        refunded_at?: string | null
      }>
    }>('wallet', {})
    if (res.success && res.data) return res.data
    return null
  }

  /** 创建教练申请 */
  async createCoachApplication(reqData: {
    name: string
    title?: string | null
    avatarUrl?: string | null
    specialties?: string[] | null
    bio?: string | null
    yearsExperience?: number | null
    achievements?: string[] | null
    teachingPhilosophy?: string | null
    credentials?: Array<{ name: string; url?: string }> | null
    caseStudies?: string[] | null
    contactEmail?: string | null
    contactPhone?: string | null
    resumeUrl?: string | null
    portfolioUrl?: string | null
    socialLinks?: Record<string, string> | null
  }) {
    const res = await this.post<{ application: any }>('create-coach-application', reqData)
    if (res.success && res.data) return res.data
    return null
  }

  /** 更新教练申请 */
  async updateCoachApplication(reqData: {
    id: string
    name?: string
    title?: string | null
    avatarUrl?: string | null
    specialties?: string[] | null
    bio?: string | null
    yearsExperience?: number | null
    achievements?: string[] | null
    teachingPhilosophy?: string | null
    credentials?: Array<{ name: string; url?: string }> | null
    caseStudies?: string[] | null
    contactEmail?: string | null
    contactPhone?: string | null
    resumeUrl?: string | null
    portfolioUrl?: string | null
    socialLinks?: Record<string, string> | null
  }) {
    const res = await this.post<{ application: any }>('update-coach-application', reqData)
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取教练申请 */
  async getCoachApplication(reqData?: { id?: string; userId?: string }) {
    const res = await this.post<{ application: any | null }>('get-coach-application', reqData || {})
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取教练聚合信息（用于教练主页） */
  async getAggregatedInfo(reqData: { coachId: string }) {
    const res = await this.post<{
      coach: any
      contentCount: number
      reviewCount: number
      studentCount: number
      averageRating: number
      specialties: string[]
    }>('get-aggregated-info', reqData)
    if (res.success && res.data) return res.data
    return null
  }

  /** 更新教练资料 */
  async updateCoachProfile(reqData: {
    id?: string
    userId?: string
    name?: string
    title?: string | null
    avatarUrl?: string | null
    specialties?: string[] | null
    yearsExperience?: number | null
    bio?: string | null
    profile?: {
      teachingPhilosophy?: string | null
      achievements?: string[] | null
      caseStudies?: string[] | null
      credentials?: Array<{ name: string; url?: string }> | null
      contactEmail?: string | null
      contactPhone?: string | null
      socialLinks?: Record<string, string> | null
    }
    invitationCode?: string
    invitationMode?: 'exclusive' | 'open'
  }) {
    const res = await this.post<{ success: boolean; message?: string }>('update-coach-profile', reqData)
    return res
  }

  /** 获取学员计划历史 */
  async getStudentPlanHistory(reqData: {
    studentId: string
    page?: number
    limit?: number
    source?: 'all' | 'coach' | 'student'
  }) {
    const res = await this.post<{
      plans: any[]
      totalCount: number
      page: number
      limit: number
      studentName: string
    }>('student-plan-history', reqData)
    if (res.success && res.data) return res.data
    return null
  }

  /** 获取收款码 */
  async getPaymentQrCodes() {
    const res = await this.post<{
      qrCodes: Array<{ type: 'wechat' | 'alipay'; name: string; url: string }>
      allowPersonalQrcode: boolean
    }>('payment-qrcodes', {})
    if (res.success && res.data) return res.data
    return null
  }

  /** 更新收款码 */
  async updatePaymentQrCodes(reqData: {
    qrCodes: Array<{ type: 'wechat' | 'alipay'; name: string; url: string }>
  }) {
    const res = await this.post<{
      qrCodes: Array<{ type: 'wechat' | 'alipay'; name: string; url: string }>
    }>('payment-qrcodes', reqData)
    if (res.success && res.data) return res.data
    return null
  }

  /** 上传收款码图片（小程序专用） */
  async uploadQrcodeMiniApp(filePath: string, type: 'wechat' | 'alipay') {
    // @ts-ignore
    const API_BASE_URL = typeof TARO_APP_API_URL !== 'undefined' ? TARO_APP_API_URL : 'http://localhost:3000'
    
    let token: string | null = null
    try {
      token = Taro.getStorageSync('token')
    } catch (e) {
      console.error('获取token失败:', e)
    }
    
    return new Promise<{ url: string } | null>((resolve) => {
      Taro.uploadFile({
        url: `${API_BASE_URL}${this.baseUrl}/upload-qrcode`,
        filePath,
        name: 'file',
        formData: {
          type
        },
        header: {
          'Authorization': token ? `Bearer ${token}` : ''
        },
        success: (res: any) => {
          try {
            const data = JSON.parse(res.data)
            if (data.success && data.data) {
              resolve(data.data)
            } else {
              resolve(null)
            }
          } catch (e) {
            console.error('解析上传响应失败:', e)
            resolve(null)
          }
        },
        fail: (err: any) => {
          console.error('上传失败:', err)
          resolve(null)
        }
      })
    })
  }

  /** 获取邀请海报状态 */
  async getPosterStatus(posterType: string = 'invitation_hd') {
    // 后端API使用GET方法，参数通过query string传递
    const res = await this.get<{
      status: 'queued' | 'generating' | 'ready' | 'failed'
      imageUrl: string | null
      updatedAt: string | null
      lastError: string | null
    }>(`poster/status?posterType=${encodeURIComponent(posterType)}`)
    if (res.success && res.data) return res.data
    return null
  }

  /** 触发生成邀请海报 */
  async triggerPoster(posterType: string = 'invitation_hd') {
    const res = await this.post<{ success: boolean; message?: string }>('poster/trigger', { posterType })
    return res
  }

  /** 获取教练某训练域的规则包（含评估表单 schema） */
  async getCoachRulepacks(reqData: { coach_id: string; domain: string }) {
    const res = await this.post<{ form_schema: { fields: Array<{
      name: string
      type: string
      label: string
      required: boolean
      min?: number
      max?: number
      options?: any[]
      placeholder?: string
    }> } | null }>('get-coach-rulepacks', reqData)
    if (res.success && res.data) return res.data
    return null
  }
}

export const coachService = new CoachService('/api/coach')

