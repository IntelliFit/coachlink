import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { buildDatedKey, cosUpload } from "@/lib/cos";
import type { LogicalBucket } from "@/lib/storageUrl";
import type { ApiData } from "@/types/api";
import type { UploadAdminCanonicalActionMediaResponseDto } from "../entity";

export const runtime = "nodejs";
export const maxDuration = 300;
export const preferredRegion = "auto";

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session?.user?.id) return { ok: false as const, status: 401, message: "未登录" };
    if (!(session.user as { is_admin?: boolean })?.is_admin) {
        return { ok: false as const, status: 403, message: "无权限" };
    }
    return { ok: true as const, userId: session.user.id };
}

function getExtension(file: File) {
    const fromName = file.name.split(".").pop()?.toLowerCase();
    if (fromName) return fromName;
    if (file.type === "image/jpeg") return "jpg";
    if (file.type === "image/png") return "png";
    if (file.type === "image/webp") return "webp";
    if (file.type === "image/gif") return "gif";
    if (file.type === "video/webm") return "webm";
    return "mp4";
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: auth.message, data: null },
            { status: auth.status },
        );
    }

    const formData = await req.formData().catch(() => null);
    const file = formData?.get("file") as File | null;
    const mediaType = formData?.get("mediaType") === "animation" ? "animation" : "image";

    if (!file) {
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "缺少文件", data: null },
            { status: 400 },
        );
    }

    const imageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    const animationTypes = new Set(["image/gif", "image/webp", "video/mp4", "video/webm"]);
    const allowed = mediaType === "image" ? imageTypes : animationTypes;
    if (!allowed.has(file.type)) {
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message: mediaType === "image"
                    ? "参考图仅支持 PNG、JPG、WebP"
                    : "缩略演示动画仅支持 GIF、WebP、MP4、WebM",
                data: null,
            },
            { status: 400 },
        );
    }

    const maxSizeBytes = mediaType === "image" ? 20 * 1024 * 1024 : 80 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        return NextResponse.json<ApiData<null>>(
            {
                success: false,
                message: mediaType === "image" ? "参考图请小于 20MB" : "缩略演示动画请小于 80MB",
                data: null,
            },
            { status: 413 },
        );
    }

    const logicalBucket: LogicalBucket = mediaType === "image"
        ? "action-reference-images"
        : "action-reference-animations";
    const key = buildDatedKey(getExtension(file), auth.userId, "canonical-actions");
    const bytes = new Uint8Array(await file.arrayBuffer());

    try {
        const uploaded = await cosUpload(logicalBucket, key, bytes, {
            contentType: file.type,
            cacheControl: "public, max-age=31536000, immutable",
        });
        return NextResponse.json<ApiData<UploadAdminCanonicalActionMediaResponseDto>>({
            success: true,
            message: "上传成功",
            data: {
                mediaType,
                url: uploaded.url,
                storage_bucket: logicalBucket,
                storage_path: key,
            },
        });
    } catch (error: any) {
        console.error("[admin/canonical-actions/upload] upload error:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: error?.message || "上传失败", data: null },
            { status: 500 },
        );
    }
}
