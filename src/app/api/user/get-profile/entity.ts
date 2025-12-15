import { UserProfilesRow } from "@/types";

// 请求参数的接口类型
export interface GetUserProfileDto {
    userId?: string;
}

// 返回参数的接口类型
export interface GetUserProfileResponseDto {
    profile: UserProfilesRow | null;
}