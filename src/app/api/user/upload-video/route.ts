import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import { createTrainingVideoRecord } from "../_helpers/videoRecord";
import type { ApiData } from "@/types/api";
import type { UploadVideoResponseDto } from "./entity";
import type { VideoUploadContext } from "@/types/video";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 重点！通过 session 获取用户 ID
    const userId = session.user.id;

    try {
        // 获取表单数据
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const contextString = formData.get("context") as string;

        if (!file || !contextString) {
            return NextResponse.json({
                success: false,
                message: "缺少必要参数",
                data: null,
            }, { status: 400 });
        }

        const context = JSON.parse(contextString) as VideoUploadContext;

        // Ensure type is treated as VideoType compatible
        if (!context?.type) {
            return NextResponse.json({
                success: false,
                message: "缺少上下文信息",
                data: null,
            }, { status: 400 });
        }

        // 上传到 Supabase Storage
        const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
        const safeName = `${Date.now()}-${uuidv4()}.${ext}`;
        const filePath = `${userId}/${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { checkStorageAvailable, incrementStorageUsage } = await import(
            "@/lib/membershipLimit"
        );

        // Check storage quota
        const quotaCheck = await checkStorageAvailable(userId, file.size);
        if (!quotaCheck.success) {
            return NextResponse.json({
                success: false,
                message: quotaCheck.message || "存储空间不足",
                data: null,
            }, { status: 403 });
        }

        const { error: uploadError } = await supabase.storage
            .from("videos")
            .upload(filePath, uint8Array, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            throw uploadError;
        }

        // Increment storage usage
        await incrementStorageUsage(userId, file.size).catch((e) =>
            console.error("Failed to update storage usage", e)
        );

        const { data: { publicUrl } } = supabase.storage
            .from("videos")
            .getPublicUrl(filePath);

        const videoRecord = await createTrainingVideoRecord({
            userId,
            videoUrl: publicUrl,
            context,
            submissionSource: "file_upload",
            fileSize: file.size,
            metadata: {
                storage_path: filePath,
                storage_bucket: "videos",
                original_filename: file.name,
                mime_type: file.type || "application/octet-stream",
            },
        });

        // 重点！必须申请接口范型位 ApiData<返回参数的接口类型>
        return NextResponse.json<ApiData<UploadVideoResponseDto>>({
            success: true,
            message: "视频上传成功",
            data: videoRecord as unknown as UploadVideoResponseDto,
        });
    } catch (error: any) {
        console.error("视频上传失败:", error);

        return NextResponse.json({
            success: false,
            message: error?.message || "视频上传失败",
            data: null,
        }, { status: 500 });
    }
}
