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
        const res = await this.post<RegisterResponseDto>("register", reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        throw new Error(res.data.message || "注册失败");

        return null;
    }

    async resetPassword(reqData: ResetPasswordDto) {
        const res = await this.post<ResetPasswordResponseDto>(
            "reset-password",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        throw new Error(res.data.message || "重置密码失败");
    }
}

export const authService = new AuthService("/api/auth");
