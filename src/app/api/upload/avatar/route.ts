import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const BUCKET = "avatars";

export async function POST(req: Request) {
    try {
        const authResult = await getAuthUser(req);
        if (!authResult.isAuthenticated || !authResult.userId) {
            return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
        }

        // 配置检查
        if (!process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY) {
            console.error("缺少 NEXT_SUPABASE_SERVICE_ROLE_KEY，无法上传头像");
            return NextResponse.json({ success: false, message: "服务端未配置 service role key" }, { status: 500 });
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
        const fileName = `${authResult.userId}/${Date.now()}.${ext}`;

        // 使用 service role 绕过 RLS
        const { error } = await serviceRoleSupabase.storage.from(BUCKET).upload(fileName, buffer, {
            contentType: file.type,
            upsert: true,
        });

        if (error) {
            console.error("upload avatar error", error);
            return NextResponse.json({ success: false, message: error.message || "上传失败，请稍后重试" }, { status: 500 });
        }

        // 优先尝试公共访问 URL（如果 bucket 已公开可直接用）
        const { data: publicUrlData } = serviceRoleSupabase.storage.from(BUCKET).getPublicUrl(fileName);
        const publicUrl = publicUrlData?.publicUrl;

        // 若 bucket 未公开则生成长效签名 URL（10 年）
        let signedUrl: string | undefined;
        if (!publicUrl) {
            const { data: signed, error: signError } = await serviceRoleSupabase.storage.from(BUCKET).createSignedUrl(fileName, 60 * 60 * 24 * 365 * 10);
            if (signError) {
                console.error("createSignedUrl error", signError);
                return NextResponse.json({ success: false, message: signError.message || "生成访问链接失败" }, { status: 500 });
            }
            signedUrl = signed?.signedUrl;
        }

        const url = publicUrl || signedUrl;
        if (!url) {
            return NextResponse.json({ success: false, message: "无法生成访问链接" }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: "上传成功",
            data: { url },
        });
    } catch (err: any) {
        console.error("upload avatar unexpected error", err);
        return NextResponse.json({ success: false, message: err?.message || "上传失败" }, { status: 500 });
    }
}

