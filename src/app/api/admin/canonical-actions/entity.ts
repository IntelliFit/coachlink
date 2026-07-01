import type { CanonicalAction, CanonicalActionAuditStatus } from "@/types/canonical";

export type CanonicalActionMediaStatus =
    | "all"
    | "missing_image"
    | "missing_animation"
    | "missing_any"
    | "complete";

export interface AdminCanonicalActionItem extends CanonicalAction {
    has_reference_image: boolean;
    has_reference_animation: boolean;
}

export interface ListAdminCanonicalActionsResponseDto {
    actions: AdminCanonicalActionItem[];
    total: number;
    page: number;
    limit: number;
    categories: string[];
    summary: {
        total: number;
        withImage: number;
        withAnimation: number;
        missingImage: number;
        missingAnimation: number;
    };
}

export interface UpdateAdminCanonicalActionDto {
    id: string;
    reference_image_url?: string | null;
    reference_image_audit_status?: CanonicalActionAuditStatus;
    reference_animation_url?: string | null;
    reference_animation_audit_status?: CanonicalActionAuditStatus;
}

export interface UpdateAdminCanonicalActionResponseDto {
    action: AdminCanonicalActionItem;
}

export interface UploadAdminCanonicalActionMediaResponseDto {
    mediaType: "image" | "animation";
    url: string;
    storage_bucket: string;
    storage_path: string;
}
