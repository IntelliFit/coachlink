import { CoachActionInsert, CoachActionRow } from "@/types";

// 使用自定义的 CoachActionInsert 类型，支持 type 字段
export type AddActionDto = CoachActionInsert;

export interface AddActionResponseDto {
    action: CoachActionRow;
}

export interface ActionSetAttr {
    name: string;
    type: "string" | "number";
    unit: string;
}
