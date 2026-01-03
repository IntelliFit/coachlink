import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const BUCKET = "avatars";

export async function POST(req: Request) {
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
        return NextResponse.json({ success: false, message: "仅支持 PNG/JPEG/WEBP 图片" }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
        return NextResponse.json({ success: false, message: "图片大小不能超过 2MB" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = file.type.split("/")[1] || "png";
    const fileName = `${session.user.id}/${Date.now()}.${ext}`;

    // 使用 service role 绕过 RLS
    const { error } = await serviceRoleSupabase.storage.from(BUCKET).upload(fileName, buffer, {
        contentType: file.type,
        upsert: true,
    });

    if (error) {
        console.error("upload avatar error", error);
        return NextResponse.json({ success: false, message: "上传失败，请稍后重试" }, { status: 500 });
    }

    // 生成签名 URL（即使 bucket 未公开也可访问）
    const { data: signed } = await serviceRoleSupabase.storage.from(BUCKET).createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 天
    const url = signed?.signedUrl;

    return NextResponse.json({
        success: true,
        message: "上传成功",
        data: { url },
    });
}

