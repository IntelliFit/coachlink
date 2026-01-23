import { BaseService } from "@/lib/baseService";

interface SliderCreateRes {
    id: string;
    trackWidth: number;
    backgroundImage: string;
}

interface SliderVerifyRes {
    token: string;
}

class CaptchaService extends BaseService {
    constructor() {
        super("/api/captcha/slider");
    }

    async create() {
        const res = await this.post<SliderCreateRes>("create", {});
        if (res.data?.success && res.data?.data) {
            return res.data.data;
        }
        throw new Error(res.data?.message || "获取验证失败");
    }

    async verify(id: string, position: number) {
        const res = await this.post<SliderVerifyRes>("verify", { id, position });
        if (res.data?.success && res.data?.data?.token) {
            return res.data.data.token;
        }
        throw new Error(res.data?.message || "验证失败");
    }
}

export const captchaService = new CaptchaService();
