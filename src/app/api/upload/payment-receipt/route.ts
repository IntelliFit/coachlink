import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import { serviceRoleSupabase as supabaseAdmin } from "@/lib/supabaseClient";

const BUCKET_NAME = "receipts";

/**
 * 支付凭证上传 API
 * 上传支付凭证图片到 Supabase Storage
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({
                success: false,
                message: "请上传文件",
                data: null,
            }, { status: 400 });
        }

        // 验证文件类型
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
        ];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({
                success: false,
                message: "仅支持 JPG、PNG、WebP、GIF 格式的图片",
                data: null,
            }, { status: 400 });
        }

        // 验证文件大小 (最大 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({
                success: false,
                message: "文件大小不能超过 5MB",
                data: null,
            }, { status: 400 });
        }

        // 检查并创建 bucket（如果不存在）
        const { data: buckets } = await supabaseAdmin.storage.listBuckets();
        const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

        if (!bucketExists) {
            const { error: createError } = await supabaseAdmin.storage
                .createBucket(BUCKET_NAME, {
                    public: true,
                    fileSizeLimit: 5 * 1024 * 1024, // 5MB
                    allowedMimeTypes: allowedTypes,
                });

            if (createError) {
                console.error("Create bucket error:", createError);
                // 继续尝试上传，bucket 可能已存在但 listBuckets 有权限问题
            }
        }

        // 生成唯一文件名
        const ext = file.name.split(".").pop() || "jpg";
        const filename =
            `${userId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

        // 转换 File 为 ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 上传到 Supabase Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .upload(filename, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return NextResponse.json({
                success: false,
                message: "上传失败: " + uploadError.message,
                data: null,
            }, { status: 500 });
        }

        // 获取公开 URL
        const { data: { publicUrl } } = supabaseAdmin.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filename);

        return NextResponse.json({
            success: true,
            message: "上传成功",
            data: {
                url: publicUrl,
                filename: filename,
            },
        });
    } catch (error) {
        console.error("Error uploading receipt:", error);
        return NextResponse.json({
            success: false,
            message: "上传失败",
            data: null,
        }, { status: 500 });
    }
}
