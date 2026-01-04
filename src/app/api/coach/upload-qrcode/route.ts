import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase, { serviceRoleSupabase } from "@/lib/supabaseClient";
import { v4 as uuidv4 } from "uuid";
import type { ApiData } from "@/types/api";

interface UploadQrCodeResponseDto {
    url: string;
}

/**
 * POST /api/coach/upload-qrcode
 * 教练上传收款码图片
 */
export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "未登录", data: null },
                { status: 401 },
            );
        }

        const userId = session.user.id;

        // 验证是否是教练
        const { data: coach } = await supabase
            .from("coaches")
            .select("id, allow_personal_qrcode")
            .eq("user_id", userId)
            .single();

        if (!coach) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "您不是教练", data: null },
                { status: 403 },
            );
        }

        if (!coach.allow_personal_qrcode) {
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: "管理员已禁止您使用个人收款码",
                    data: null,
                },
                { status: 403 },
            );
        }

        // 解析FormData
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const type = formData.get("type") as string; // wechat 或 alipay

        if (!file || !type) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "缺少文件或类型参数", data: null },
                { status: 400 },
            );
        }

        if (!["wechat", "alipay"].includes(type)) {
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: "类型必须是 wechat 或 alipay",
                    data: null,
                },
                { status: 400 },
            );
        }

        // 上传到 Supabase Storage (使用 payment-qrcodes bucket)
        const ext = file.name.split(".").pop() || "png";
        const safeName = `${type}_${Date.now()}_${uuidv4()}.${ext}`;
        const filePath = `${userId}/${safeName}`;

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const { error: uploadError } = await serviceRoleSupabase.storage
            .from("payment-qrcodes")
            .upload(filePath, uint8Array, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            console.error("上传失败:", uploadError);
            return NextResponse.json<ApiData<null>>(
                {
                    success: false,
                    message: "上传失败: " + uploadError.message,
                    data: null,
                },
                { status: 500 },
            );
        }

        // 获取公开URL
        const { data: { publicUrl } } = serviceRoleSupabase.storage
            .from("payment-qrcodes")
            .getPublicUrl(filePath);

        return NextResponse.json<ApiData<UploadQrCodeResponseDto>>({
            success: true,
            message: "上传成功",
            data: { url: publicUrl },
        });
    } catch (error) {
        console.error("上传收款码失败:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}
