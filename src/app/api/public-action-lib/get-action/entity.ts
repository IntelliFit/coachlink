import type { PublicActionItemDto } from "../list-actions/entity";

export interface GetPublicActionDto {
    actionId: string;
    viewerActionType?: "student" | "coach";
}

export interface GetPublicActionResponseDto {
    action: PublicActionItemDto;
}

