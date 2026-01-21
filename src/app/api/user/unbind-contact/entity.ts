export type UnbindContactType = "phone" | "email" | "wechat";

export interface UnbindContactDto {
  type: UnbindContactType;
}

export interface UnbindContactResponseDto {
  success: true;
}

