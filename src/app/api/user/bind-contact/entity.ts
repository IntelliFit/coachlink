export type BindContactType = "phone" | "email";

export interface BindContactDto {
  type: BindContactType;
  value: string;
  verifyCode: string;
}

export interface BindContactResponseDto {
  success: true;
}

