import { request } from '../utils/request'
import Taro from '@tarojs/taro'

interface LoginWithPasswordDto {
  phoneOrEmail: string
  password: string
}

interface LoginWithCodeDto {
  phoneOrEmail: string
  verifyCode: string
}

/** 与网页端 /api/auth/register 一致 */
interface RegisterDto {
  phoneOrEmail: string
  password: string
  verifyCode: string
  ref?: string
  shareId?: string
  invitationCode?: string
  invitationMode?: 'exclusive' | 'open'
}

interface ResetPasswordDto {
  phone: string
  verifyCode: string
  newPassword: string
}

interface AuthSessionState {
  user: any | null
  token: string
  userId: string | null
  hasUser: boolean
  hasToken: boolean
  isAuthenticated: boolean
  isStale: boolean
  primaryRole: 'student' | 'coach' | 'admin'
  isCoach: boolean
}

interface AccountSyncState {
  status: 'synced' | 'wechat_only'
  phone: string | null
}

class WechatLoginError extends Error {
  code?: string
  data?: unknown

  constructor(message: string, code?: string, data?: unknown) {
    super(message)
    this.name = 'WechatLoginError'
    this.code = code
    this.data = data
  }
}

class AuthService {
  private readonly postAuthHomeUrl = '/pages/index/index'

  private clearStoredAuth() {
    Taro.removeStorageSync('user')
    Taro.removeStorageSync('token')
  }

  private persistSession(user: any, token?: string | null) {
    const userId = user?.id ? String(user.id) : null
    const normalizedToken = typeof token === 'string' ? token.trim() : ''

    if (!userId || !normalizedToken) {
      this.clearStoredAuth()
      console.error('❌ 登录结果缺少完整登录态:', {
        hasUserId: !!userId,
        hasToken: !!normalizedToken
      })
      throw new Error('登录结果异常，请重新登录')
    }

    Taro.setStorageSync('token', normalizedToken)
    Taro.setStorageSync('user', user)

    return {
      user,
      token: normalizedToken
    }
  }

  /**
   * 使用密码登录
   * 使用小程序专用登录接口（不依赖 Cookie 和 next-auth）
   */
  async loginWithPassword(reqData: LoginWithPasswordDto) {
    console.log('🔐 开始密码登录:', {
      phoneOrEmail: reqData.phoneOrEmail,
      hasPassword: !!reqData.password
    })
    
    const res = await request<{ user: any; token?: string }>({
      url: '/api/miniapp/login',
      method: 'POST',
      data: {
        phoneOrEmail: reqData.phoneOrEmail,
        password: reqData.password
      }
    })
    
    console.log('📦 登录API响应:', res)
    
    // 检查响应格式
    if (!res || typeof res !== 'object') {
      console.error('❌ 登录失败: 响应格式错误')
      throw new Error('登录失败')
    }
    
    // 检查是否成功
    if ('success' in res && !res.success) {
      console.error('❌ 登录失败:', res.message)
      throw new Error(res.message || '登录失败')
    }
    
    // 登录成功
    if ('data' in res && res.data && res.data.user) {
      console.log('✅ 登录成功')

      this.persistSession(res.data.user, res.data.token)
      console.log('🔑 登录态已存储')

      return res.data
    }
    
    console.error('❌ 登录失败: 响应格式不正确')
    throw new Error('登录失败')
  }

  /**
   * 使用验证码登录
   * 使用小程序专用登录接口（不依赖 Cookie 和 next-auth）
   */
  async loginWithCode(reqData: LoginWithCodeDto) {
    console.log('🔐 开始验证码登录:', {
      phoneOrEmail: reqData.phoneOrEmail,
      hasVerifyCode: !!reqData.verifyCode
    })
    
    const res = await request<{ user: any; token?: string }>({
      url: '/api/miniapp/login',
      method: 'POST',
      data: {
        phoneOrEmail: reqData.phoneOrEmail,
        verifyCode: reqData.verifyCode
      }
    })
    
    console.log('📦 登录API响应:', res)
    
    // 检查响应格式
    if (!res || typeof res !== 'object') {
      console.error('❌ 登录失败: 响应格式错误')
      throw new Error('登录失败')
    }
    
    // 检查是否成功
    if ('success' in res && !res.success) {
      console.error('❌ 登录失败:', res.message)
      throw new Error(res.message || '登录失败')
    }
    
    // 登录成功
    if ('data' in res && res.data && res.data.user) {
      console.log('✅ 登录成功')

      this.persistSession(res.data.user, res.data.token)
      console.log('🔑 登录态已存储')

      return res.data
    }
    
    console.error('❌ 登录失败: 响应格式不正确')
    throw new Error('登录失败')
  }


  /**
   * 注册（与网页端 /api/auth/register 一致）
   * 注册成功后需自行调用 loginWithPassword 完成登录并存储 token/user
   */
  async register(reqData: RegisterDto) {
    const res = await request<{ user: any }>({
      url: '/api/auth/register',
      method: 'POST',
      data: {
        phoneOrEmail: reqData.phoneOrEmail.trim(),
        password: reqData.password.trim(),
        verifyCode: reqData.verifyCode.trim(),
        ref: reqData.ref || undefined,
        shareId: reqData.shareId || undefined,
        invitationCode: reqData.invitationCode?.trim() || undefined,
        invitationMode: reqData.invitationMode
      }
    })
    if (!res || typeof res !== 'object') {
      throw new Error('注册失败')
    }
    if ('success' in res && !res.success) {
      throw new Error(res.message || '注册失败')
    }
    if ('data' in res && res.data?.user) {
      return res.data
    }
    throw new Error(res.message || '注册失败')
  }

  /**
   * 重置密码（通过手机验证码）
   */
  async resetPassword(reqData: ResetPasswordDto) {
    const res = await request<{ success?: boolean }>({
      url: '/api/auth/reset-password',
      method: 'POST',
      data: {
        phone: reqData.phone.trim(),
        verifyCode: reqData.verifyCode.trim(),
        newPassword: reqData.newPassword.trim()
      }
    })

    if (!res || typeof res !== 'object') {
      throw new Error('重置失败')
    }
    if ('success' in res && !res.success) {
      throw new Error(res.message || '重置失败')
    }
    return res
  }

  /**
   * 退出登录
   */
  async logout() {
    // 清除用户信息和token
    this.clearStoredAuth()
    console.log('🚪 已退出登录，清除用户信息和token')
    // 如后续需要服务端会话失效，可在这里补充对应后端接口调用
  }

  getToken() {
    try {
      const token = Taro.getStorageSync('token')
      return typeof token === 'string' ? token : ''
    } catch {
      return ''
    }
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    try {
      return Taro.getStorageSync('user')
    } catch {
      return null
    }
  }

  getAuthSession(options?: { normalize?: boolean }): AuthSessionState {
    let user = this.getCurrentUser()
    let token = this.getToken()
    let userId = user?.id ? String(user.id) : null
    let hasUser = !!userId
    let hasToken = !!token
    let isStale = hasUser !== hasToken

    if (options?.normalize && isStale) {
      console.warn('⚠️ 检测到不完整登录态，已自动清理', {
        hasUser,
        hasToken
      })
      this.clearStoredAuth()
      user = null
      token = ''
      userId = null
      hasUser = false
      hasToken = false
      isStale = false
    }

    const isAuthenticated = hasUser && hasToken
    const primaryRole =
      isAuthenticated && (user?.primary_role === 'coach' || user?.primary_role === 'admin')
        ? user.primary_role
        : 'student'
    const isCoach = isAuthenticated && !!user?.is_coach

    return {
      user,
      token,
      userId,
      hasUser,
      hasToken,
      isAuthenticated,
      isStale,
      primaryRole,
      isCoach
    }
  }

  normalizeAuthSession() {
    return this.getAuthSession({ normalize: true })
  }

  isAuthenticated() {
    return this.getAuthSession({ normalize: true }).isAuthenticated
  }

  buildPostAuthHomeUrl() {
    return this.postAuthHomeUrl
  }

  buildLoginUrl(returnTo = this.postAuthHomeUrl) {
    return '/auth/login?returnTo=' + encodeURIComponent(returnTo)
  }

  setCurrentUser(user: any) {
    if (!user) {
      this.clearStoredAuth()
      return null
    }

    const token = this.getToken()
    if (!token) {
      console.warn('⚠️ setCurrentUser 时未发现 token，已放弃写入并清理旧登录态')
      this.clearStoredAuth()
      return null
    }

    Taro.setStorageSync('user', user)
    return user
  }

  mergeCurrentUser(partial: Record<string, any>) {
    const currentUser = this.getCurrentUser()
    if (!currentUser) return null
    const nextUser = {
      ...currentUser,
      ...partial
    }
    this.setCurrentUser(nextUser)
    return nextUser
  }

  /**
   * 当前是否以教练端身份展示（与 web 端 primary_role 一致）
   */
  getPrimaryRole(): 'student' | 'coach' | 'admin' {
    return this.getAuthSession({ normalize: true }).primaryRole
  }

  /**
   * 是否具备教练资格（已通过审核的教练）
   */
  isCoach(): boolean {
    return this.getAuthSession({ normalize: true }).isCoach
  }

  /**
   * 切换身份（学员端 / 教练端）
   * 调用后端更新 primary_role，并更新本地存储，不负责跳转
   */
  async switchRole(role: 'student' | 'coach') {
    const res = await request<{ primary_role: string }>({
      url: '/api/user/switch-role',
      method: 'POST',
      data: { role }
    })
    if (!res || !res.success || !res.data) {
      throw new Error(res?.message || '切换失败')
    }
    const user = this.getCurrentUser()
    if (user) {
      user.primary_role = res.data.primary_role
      this.setCurrentUser(user)
    }
    return res.data.primary_role
  }

  /**
   * 绑定微信 openid 到当前账号（密码登录用户支付前需要调用）
   * 调用 wx.login() 获取 code 并发送到后端绑定
   */
  async bindWechatOpenid(): Promise<{ success: boolean; message?: string }> {
    try {
      const loginRes = await Taro.login()
      if (!loginRes.code) {
        return { success: false, message: '获取微信登录凭证失败' }
      }

      const res = await request<{ openid: string }>({
        url: '/api/miniapp/bind-wechat',
        method: 'POST',
        data: { code: loginRes.code },
        showErrorToast: false,
      })

      if (!res.success) {
        return { success: false, message: res.message || '绑定失败' }
      }

      const user = this.getCurrentUser()
      if (user) {
        user.wechat_openid = res.data?.openid
        Taro.setStorageSync('user', user)
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, message: error?.message || '绑定微信失败' }
    }
  }

  /**
   * 微信登录（同时获取手机号）
   * 调用 wx.login() 获取 code，然后调用后端接口获取用户登录信息和手机号
   * 文档：https://developers.weixin.qq.com/miniprogram/dev/api/open-api/login/wx.login.html
   * @param phoneCode 手机号授权的 code（从 getPhoneNumber 事件中获取），如果为 null 则跳过手机号获取
   */
  async loginWithWechat(phoneCode?: string | null) {
    console.log('🔐 开始微信登录流程', phoneCode ? '（含手机号授权）' : '')
    
    try {
      // 第一步：调用 wx.login() 获取 code
      console.log('📱 调用 wx.login() 获取 code...')
      const loginRes = await Taro.login()
      
      if (!loginRes.code) {
        console.error('❌ wx.login() 失败:', loginRes.errMsg)
        throw new Error(loginRes.errMsg || '获取登录凭证失败')
      }
      
      console.log('✅ 获取到 code:', loginRes.code.substring(0, 10) + '...')
      
      // 第二步：将 code 和 phoneCode 发送到后端，换取用户身份和手机号
      console.log('📤 发送 code 和 phoneCode 到后端换取用户信息...')
      const res = await request<{
        token: string // JWT token，用于后续API请求鉴权
        openid: string
        unionid?: string | null
        user: any
        accountSync?: AccountSyncState
      }>({
        url: '/api/miniapp/wechat-login',
        method: 'POST',
        data: {
          code: loginRes.code,
          phoneCode: phoneCode || null
        }
      })
      
      console.log('📦 微信登录API响应:', res)
      
      // 检查响应格式
      if (!res || typeof res !== 'object') {
        console.error('❌ 微信登录失败: 响应格式错误')
        throw new Error('微信登录失败')
      }
      
      // 检查是否成功
      if ('success' in res && !res.success) {
        console.error('❌ 微信登录失败:', res.message)
        throw new WechatLoginError(
          res.message || '微信登录失败',
          typeof res.code === 'string'
            ? res.code
            : (typeof res.errorCode === 'string' ? res.errorCode : undefined),
          res.data
        )
      }
      
      // 登录成功，获取用户信息
      if ('data' in res && res.data) {
        const { token, openid, unionid, user } = res.data
        
        console.log('✅ 微信登录成功！')
        console.log('📋 用户登录信息:')
        console.log('  - openid:', openid)
        console.log('  - unionid:', unionid || 'null')
        console.log('  - user:', user)
        
        this.persistSession(user, token)
        console.log('💾 用户登录态已存储')

        return res.data
      }
      
      console.error('❌ 微信登录失败: 响应格式不正确')
      throw new Error('微信登录失败')
      
    } catch (error: any) {
      console.error('❌ 微信登录流程错误:', error)
      throw error
    }
  }
}

export const authService = new AuthService()

