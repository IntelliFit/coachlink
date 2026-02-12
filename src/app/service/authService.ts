import { BaseService } from "@/lib/baseService";
import type {
    RegisterDto,
    RegisterResponseDto,
} from "../api/auth/register/entity";
import type {
    ResetPasswordDto,
    ResetPasswordResponseDto,
} from "../api/auth/reset-password/entity";

export class AuthService extends BaseService {
    async register(reqData: RegisterDto) {
        try {
            const res = await this.post<RegisterResponseDto>("register", reqData);
            if (res.data && res.data.success) {
                return res.data.data;
            }
            throw new Error(res.data?.message || "注册失败");
        } catch (err: any) {
            // 接口返回 4xx/5xx 时 axios 会抛错，从 response.data 取后端返回的友好文案
            const msg = err?.response?.data?.message;
            if (msg && typeof msg === "string") {
                throw new Error(msg);
            }
            if (err instanceof Error) throw err;
            throw new Error("网络异常，请稍后重试");
        }
    }

    async resetPassword(reqData: ResetPasswordDto) {
        try {
            const res = await this.post<ResetPasswordResponseDto>(
                "reset-password",
                reqData,
            );
            if (res.data && res.data.success) {
                return res.data.data;
            }
            throw new Error(res.data?.message || "重置密码失败");
        } catch (err: any) {
            const msg = err?.response?.data?.message;
            if (msg && typeof msg === "string") {
                throw new Error(msg);
            }
            if (err instanceof Error) throw err;
            throw new Error("网络异常，请稍后重试");
        }
    }
}

export const authService = new AuthService("/api/auth");
