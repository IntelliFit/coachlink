import { API_BASE_URL, BaseService } from '../../utils/request'
import Taro from '@tarojs/taro'

interface CoachApplicationMaterial {
  id: string
  category: 'achievement' | 'case' | 'credential' | 'media'
  title: string
  summary?: string | null
  detail?: string | null
  isPublic: boolean
  media: Array<{
    id: string
    type: 'image' | 'video'
    url: string
    thumbnailUrl?: string | null
    storageBucket?: string | null
    storagePath?: string | null
    fileName?: string | null
    fileSizeBytes?: number | null
    contentType?: string | null
  }>
  links: Array<{ id: string; label?: string | null; url: string }>
}

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
      receivingAccountReady: boolean
      huifuOpenStatus: string | null
      huifuOpenMsg: string | null
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
      gross_balance?: number
      withdrawable_balance?: number
      total_income?: number
      frozen_amount?: number
      refund_protected_amount?: number
      pending_settlement_amount?: number
      refund_protection_days?: number
      huifu_open_status?: string | null
      huifu_open_msg?: string | null
      withdrawal_rules?: {
        min_amount: number
        max_amount: number
        amount_description: string
        daily_count_description: string
        availability_description: string
        arrival_type: 'D0' | 'D1' | 'DM' | 'T1'
        arrival_description: string
        fee_description: string
        destination_description: string
      }
      pending_settlements?: Array<{
        id: string
        amount: number
        platform_fee: number
        total_amount: number
        status: 'pending' | 'processing' | 'split_failed'
        eligible_at: string | null
        created_at: string
        alipay_order_id: string
        subject?: string | null
        student_id?: string | null
        student_name?: string | null
        error_message?: string | null
      }>
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
        platform_fee?: number | null
      }>
    }>('wallet', {})
    if (res.success && res.data) return res.data
    return null
  }

  /** 开通/重新提交汇付收款账户 */
  async openHuifuAccount(reqData: {
    name: string
    certNo: string
    mobileNo: string
    certValidityType: string
    certBeginDate: string
    certEndDate?: string
    idCardFront?: string
    idCardBack?: string
    cardNo: string
    cardName: string
    bankCode: string
    branchCode: string
    branchName: string
    provId: string
    areaId: string
  }) {
    const res = await this.post<{ huifu_id: string; apply_no?: string }>('merchant/open-huifu-account', reqData)
    return res
  }

  /** 汇付提现到已绑定银行卡 */
  async withdrawHuifu(amount: number) {
    const res = await this.post<{ hfSeqId?: string }>('wallet/huifu/withdraw', { amount })
    return res
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
    applicationMaterials?: CoachApplicationMaterial[] | null
    coachTrack?: string | null
    serviceModes?: string[] | null
    targetStudentLevels?: string[] | null
    supportFocus?: string | null
    province?: string | null
    city?: string | null
    county?: string | null
    address?: string | null
    latitude?: number | null
    longitude?: number | null
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
    applicationMaterials?: CoachApplicationMaterial[] | null
    coachTrack?: string | null
    serviceModes?: string[] | null
    targetStudentLevels?: string[] | null
    supportFocus?: string | null
    province?: string | null
    city?: string | null
    county?: string | null
    address?: string | null
    latitude?: number | null
    longitude?: number | null
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

  /** 获取教练主页公开展示的学员评价 */
  async getPublicReviews(reqData: { coachId: string }) {
    const res = await this.post<{
      reviews: Array<{
        id: string
        studentId: string
        studentName: string
        studentAvatarUrl: string | null
        comment: string
        rating: number | null
        createdAt: string | null
      }>
    }>('get-public-reviews', reqData)
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
      applicationMaterials?: CoachApplicationMaterial[] | null
    }
    invitationCode?: string
    invitationMode?: 'exclusive' | 'open'
  }) {
    const res = await this.post<{ success: boolean; message?: string }>('update-coach-profile', reqData)
    return res
  }

  /** 上传教练申请/主页材料（小程序专用） */
  async uploadApplicationMediaMiniApp(filePath: string) {
    let token = ''
    try {
      token = Taro.getStorageSync('token') || ''
    } catch (e) {
      console.error('获取token失败:', e)
    }

    return new Promise<{
      type: 'image' | 'video'
      url: string
      thumbnailUrl?: string | null
      storageBucket: string
      storagePath: string
      fileName: string
      fileSizeBytes: number
      contentType: string
    } | null>((resolve, reject) => {
      Taro.uploadFile({
        url: `${API_BASE_URL}${this.baseUrl}/upload-application-media`,
        filePath,
        name: 'file',
        header: {
          Authorization: token ? `Bearer ${token}` : ''
        },
        success: (res: any) => {
          try {
            const data = JSON.parse(res.data)
            if (data.success && data.data) {
              resolve(data.data)
            } else {
              reject(new Error(data.message || '上传失败'))
            }
          } catch (e) {
            reject(e)
          }
        },
        fail: reject
      })
    })
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
  async getAutomationPolicy() {
    const res = await this.get<{
      coachId: string
      policy: any
      source: string
      row: any
    }>('automation-policy')
    if (res.success && res.data) return res.data
    return null
  }

  async updateAutomationPolicy(policy: any) {
    const res = await this.put<{
      coachId: string
      policy: any
      source: string
      row: any
    }>('automation-policy', policy)
    if (res.success && res.data) return res.data
    return null
  }

  async getAutomationJobs(params?: { subscriptionId?: string; limit?: number }) {
    const query = [
      params?.subscriptionId ? `subscriptionId=${encodeURIComponent(params.subscriptionId)}` : null,
      `limit=${encodeURIComponent(String(params?.limit ?? 30))}`
    ].filter(Boolean).join('&')
    const res = await this.get<{ jobs: any[]; drafts: any[] }>(`automation-jobs?${query}`)
    if (res.success && res.data) return res.data
    return null
  }

  async getStudentAutomationOverride(params: { subscriptionId: string }) {
    const res = await this.get<{
      subscriptionId: string
      override: any
      effectivePolicy: any
      source: string
    }>(`student-automation-override?subscriptionId=${encodeURIComponent(params.subscriptionId)}`)
    if (res.success && res.data) return res.data
    return null
  }

  async updateStudentAutomationOverride(payload: any) {
    const res = await this.put<{
      subscriptionId: string
      override: any
      effectivePolicy: any
      source: string
    }>('student-automation-override', payload)
    if (res.success && res.data) return res.data
    return null
  }

  async applyPlanAdjustmentDraft(draftId: string) {
    const res = await this.post<{ draft: any }>(
      `plan-adjustment-drafts/${encodeURIComponent(draftId)}/apply`,
      {}
    )
    if (res.success && res.data) return res.data
    return null
  }

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
