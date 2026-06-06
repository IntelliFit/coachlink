import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { cosUpload, buildDatedKey } from "@/lib/cos";
import type { ApiData } from "@/types/api";
import { validateCoachApplicationMediaUpload } from "@/lib/coachApplicationMaterials";
import type { UploadCoachApplicationMediaResponseDto } from "./entity";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

const BUCKET = "videos";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id || null;

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const validation = validateCoachApplicationMediaUpload({
            userId,
            contentType: file?.type,
            sizeBytes: file?.size,
        });

        if (!file || !validation.ok) {
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: validation.ok ? "缺少文件" : validation.message,
                    data: null,
                },
                { status: validation.ok ? 400 : validation.status },
            );
        }

        const ext = (file.name.split(".").pop() ||
            (validation.mediaType === "image" ? "png" : "mp4")).toLowerCase();
        const storagePath = buildDatedKey(ext, userId ?? undefined, "application");
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { url } = await cosUpload(BUCKET, storagePath, uint8Array, {
            contentType: file.type || "application/octet-stream",
        });

        return NextResponse.json<ApiData<UploadCoachApplicationMediaResponseDto>>({
            success: true,
            message: "上传成功",
            data: {
                type: validation.mediaType,
                url,
                thumbnailUrl: null,
                storageBucket: BUCKET,
                storagePath,
                fileName: file.name,
                fileSizeBytes: file.size,
                contentType: file.type || "application/octet-stream",
            },
        });
    } catch (err) {
        console.error("[upload-application-media] unexpected error:", err);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}
