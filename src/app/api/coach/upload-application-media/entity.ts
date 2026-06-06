import type { CoachApplicationMaterialMediaType } from "@/lib/coachApplicationMaterials";

export interface UploadCoachApplicationMediaResponseDto {
    type: CoachApplicationMaterialMediaType;
    url: string;
    thumbnailUrl?: string | null;
    storageBucket: string;
    storagePath: string;
    fileName: string;
    fileSizeBytes: number;
    contentType: string;
}
