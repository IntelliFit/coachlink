import { BaseService } from "@/lib/baseService";
import type { SendVerificationCodeDto, SendVerificationCodeResponseDto } from '../api/ses/send-verification-code/entity';

class SesService extends BaseService {

    async sendVerificationCode(reqData: SendVerificationCodeDto) {
        const res = await this.post<SendVerificationCodeResponseDto>('send-verification-code', reqData);
        console.log(res);
        
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data?.message || '发送验证码失败');
    }
}

export const sesService = new SesService('/api/ses');