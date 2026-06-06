import { NextResponse } from "next/server";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import { cosUpload, buildDatedKey } from "@/lib/cos";

/**
 * 支付凭证上传 API
 * 上传支付凭证图片到腾讯云 COS
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

        const ext = file.name.split(".").pop() || "jpg";
        const key = buildDatedKey(ext, userId);

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { url } = await cosUpload("receipts", key, buffer, { contentType: file.type });

        return NextResponse.json({
            success: true,
            message: "上传成功",
            data: {
                url,
                filename: key,
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
