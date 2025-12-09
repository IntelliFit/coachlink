import { BaseService } from "@/lib/baseService";
import type { SendSmsDto, SendSmsResponseDto } from '../api/sms/send/entity';
import type { SendVerificationCodeDto, SendVerificationCodeResponseDto } from '../api/sms/send-verification-code/entity';
import type { VerifyCodeDto, VerifyCodeResponseDto } from '../api/sms/verify-code/entity';
import { ApiData } from "@/types/api";

class SmsService extends BaseService {

    async sendVerificationCode(reqData: SendVerificationCodeDto) {
        const res = await this.post<SendVerificationCodeResponseDto>('send-verification-code', reqData);
        console.log(res);
        
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || '发送验证码失败');
    }

    async verifyCode(reqData: VerifyCodeDto) {
        const res = await this.post<VerifyCodeResponseDto>('verify-code', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || '验证验证码失败');
    }
}

export const smsService = new SmsService('/api/sms');