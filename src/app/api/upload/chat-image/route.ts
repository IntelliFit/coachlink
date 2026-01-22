import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
const BUCKET = "chat-images";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({ success: false, message: "未登录" }, { status: 401 });
        }

        // 配置检查
        if (!process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY) {
            console.error("缺少 NEXT_SUPABASE_SERVICE_ROLE_KEY，无法上传图片");
            return NextResponse.json({ success: false, message: "服务端未配置 service role key" }, { status: 500 });
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

        // 检查并创建 bucket（如果不存在）
        const { data: buckets } = await serviceRoleSupabase.storage.listBuckets();
        const bucketExists = buckets?.some((b) => b.name === BUCKET);

        if (!bucketExists) {
            const { error: createError } = await serviceRoleSupabase.storage
                .createBucket(BUCKET, {
                    public: true,
                    fileSizeLimit: MAX_SIZE,
                    allowedMimeTypes: ALLOWED_TYPES,
                });

            if (createError) {
                console.error("Create bucket error:", createError);
                // 继续尝试上传，bucket 可能已存在但 listBuckets 有权限问题
            }
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const ext = file.type.split("/")[1] || "jpg";
        const fileName = `${session.user.id}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

        // 使用 service role 绕过 RLS
        const { error } = await serviceRoleSupabase.storage.from(BUCKET).upload(fileName, buffer, {
            contentType: file.type,
            upsert: false,
        });

        if (error) {
            console.error("upload chat image error", error);
            return NextResponse.json({ success: false, message: error.message || "上传失败，请稍后重试" }, { status: 500 });
        }

        // 获取公开 URL
        const { data: { publicUrl } } = serviceRoleSupabase.storage.from(BUCKET).getPublicUrl(fileName);

        if (!publicUrl) {
            return NextResponse.json({ success: false, message: "无法生成访问链接" }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: "上传成功",
            data: { 
                url: publicUrl,
                filename: fileName,
            },
        });
    } catch (err: any) {
        console.error("upload chat image unexpected error", err);
        return NextResponse.json({ success: false, message: err?.message || "上传失败" }, { status: 500 });
    }
}
