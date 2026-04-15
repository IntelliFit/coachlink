import { BaseService } from '../utils/request'

interface SendVerificationCodeDto {
  phoneNumber: string
  captchaToken?: string
}

interface SendVerificationCodeResponseDto {
  success: boolean
  message?: string
}

class SmsService extends BaseService {
  async sendVerificationCode(reqData: SendVerificationCodeDto) {
    const res = await this.post<SendVerificationCodeResponseDto>('send-verification-code', reqData)
    
    if (res.success && res.data) {
      return res.data
    }
    throw new Error(res.message || '发送验证码失败')
  }
}

export const smsService = new SmsService('/api/sms')

