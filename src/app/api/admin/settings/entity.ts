// 管理员设置 API 类型定义

export interface GetSettingsDto {
    key?: string; // 可选，指定获取某个配置项
}

export interface GetSettingsResponseDto {
    settings: PlatformSetting[];
}

export interface UpdateSettingDto {
    key: string;
    value: any;
}

export interface UpdateSettingResponseDto {
    setting: PlatformSetting;
}

export interface PlatformSetting {
    id: string;
    key: string;
    value: any;
    description?: string;
    created_at: string;
    updated_at: string;
}

// 支付模式配置值类型
export interface PaymentModeConfig {
    default_mode: "qrcode" | "alipay_api" | "both";
}
