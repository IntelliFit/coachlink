import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
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

        if (
            !process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY &&
            !process.env.SUPABASE_SERVICE_ROLE_KEY
        ) {
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: "服务器配置缺失：未设置 Supabase Service Role Key，无法上传申请材料",
                    data: null,
                },
                { status: 500 },
            );
        }

        const ext = (file.name.split(".").pop() ||
            (validation.mediaType === "image" ? "png" : "mp4")).toLowerCase();
        const safeName = `${Date.now()}-${uuidv4()}.${ext}`;
        const storagePath = `${userId}/application/${safeName}`;
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, uint8Array, {
                contentType: file.type || "application/octet-stream",
                upsert: false,
            });

        if (uploadError) {
            console.error("[upload-application-media] upload failed:", uploadError);
            return NextResponse.json<ApiData<null>>(
                { success: false, message: uploadError.message || "上传失败", data: null },
                { status: 500 },
            );
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

        return NextResponse.json<ApiData<UploadCoachApplicationMediaResponseDto>>({
            success: true,
            message: "上传成功",
            data: {
                type: validation.mediaType,
                url: publicUrl,
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
