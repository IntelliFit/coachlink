import { BaseService } from '../utils/request'

interface CreateCaptchaResponseDto {
  id: string
  /** 目标位置百分比 (30-90) */
  targetPercent: number
}

interface VerifyCaptchaDto {
  id: string
  /** 用户滑块位置百分比 */
  percent: number
}

interface VerifyCaptchaResponseDto {
  token: string
}

class CaptchaService extends BaseService {
  /**
   * 创建验证码挑战
   */
  async create() {
    const res = await this.post<CreateCaptchaResponseDto>('create', {})
    
    if (res.success && res.data) {
      return res.data
    }
    throw new Error(res.message || '创建验证码失败')
  }

  /**
   * 验证滑块位置（百分比）
   */
  async verify(id: string, percent: number) {
    const res = await this.post<VerifyCaptchaResponseDto>('verify', {
      id,
      percent
    } as VerifyCaptchaDto)
    
    if (res.success && res.data) {
      return res.data.token
    }
    throw new Error(res.message || '验证失败')
  }
}

export const captchaService = new CaptchaService('/api/captcha/slider')
