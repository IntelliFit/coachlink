import { BaseService } from '../utils/request'

interface SendVerificationCodeDto {
  email: string
  captchaToken?: string
}

interface SendVerificationCodeResponseDto {
  success: boolean
  message?: string
}

class SesService extends BaseService {
  async sendVerificationCode(reqData: SendVerificationCodeDto) {
    const res = await this.post<SendVerificationCodeResponseDto>('send-verification-code', reqData)
    
    if (res.success && res.data) {
      return res.data
    }
    throw new Error(res.message || '发送验证码失败')
  }
}

export const sesService = new SesService('/api/ses')

