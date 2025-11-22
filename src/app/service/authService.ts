import { BaseService } from "@/lib/baseService";
import type { RegisterDto, RegisterResponseDto } from "../api/auth/register/entity";


export class AuthService extends BaseService {
    async register(reqData: RegisterDto) {
        const res = await this.post<RegisterResponseDto>('register', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }
}

export const authService = new AuthService('/api/auth');