import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { cosUpload, buildDatedKey } from "@/lib/cos";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ success: false, message: "未选择文件" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ success: false, message: "仅支持 PNG/JPEG/WEBP/GIF 图片" }, { status: 400 });
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json({ success: false, message: "图片大小不能超过 10MB" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const ext = file.type.split("/")[1] || "jpg";
        const key = buildDatedKey(ext, session.user.id);

        const { url } = await cosUpload("chat-images", key, buffer, { contentType: file.type });

        return NextResponse.json({
            success: true,
            message: "上传成功",
            data: {
                url,
                filename: key,
            },
        });
    } catch (err: any) {
        console.error("upload chat image unexpected error", err);
        return NextResponse.json({ success: false, message: err?.message || "上传失败" }, { status: 500 });
    }
}
