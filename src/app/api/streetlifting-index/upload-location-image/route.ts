import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { StreetliftingUploadLocationImageResponseDto } from "./entity";

const BUCKET_NAME = "streetlifting-locations";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
    try {
        await getServerSession();
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json<ApiData<StreetliftingUploadLocationImageResponseDto>>({
                success: false,
                message: "请上传图片",
                data: null,
            }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json<ApiData<StreetliftingUploadLocationImageResponseDto>>({
                success: false,
                message: "仅支持 JPG、PNG、WebP、GIF 格式",
                data: null,
            }, { status: 400 });
        }

        if (file.size > MAX_IMAGE_BYTES) {
            return NextResponse.json<ApiData<StreetliftingUploadLocationImageResponseDto>>({
                success: false,
                message: "图片过大，单张图片请小于 5MB",
                data: null,
            }, { status: 413 });
        }

        const adminClient = serviceRoleSupabase;
        try {
            const { data: buckets } = await adminClient.storage.listBuckets();
            const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);
            if (!bucketExists) {
                await adminClient.storage.createBucket(BUCKET_NAME, {
                    public: true,
                    fileSizeLimit: MAX_IMAGE_BYTES,
                    allowedMimeTypes: ALLOWED_TYPES,
                });
            }
        } catch (bucketError) {
            console.warn("[streetlifting-index][upload] bucket check error:", bucketError);
        }

        const ext = (file.name.split(".").pop() || "png").toLowerCase();
        const filePath = `locations/${Date.now()}-${crypto.randomUUID()}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await adminClient.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("[streetlifting-index][upload] upload error:", uploadError);
            return NextResponse.json<ApiData<StreetliftingUploadLocationImageResponseDto>>({
                success: false,
                message: uploadError.message || "上传失败",
                data: null,
            }, { status: 500 });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        return NextResponse.json<ApiData<StreetliftingUploadLocationImageResponseDto>>({
            success: true,
            message: "上传成功",
            data: {
                url: publicUrl,
                storage_bucket: BUCKET_NAME,
                storage_path: filePath,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][upload] error:", error);
        return NextResponse.json<ApiData<StreetliftingUploadLocationImageResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
