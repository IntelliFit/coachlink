import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import type {
    GetPaymentQrCodesResponseDto,
    QrCodeItem,
    UpdatePaymentQrCodesDto,
    UpdatePaymentQrCodesResponseDto,
} from "./entity";

// 获取教练的收款码
export async function GET(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 获取当前用户对应的教练信息
    const { data: coach, error } = await supabase
        .from("coaches")
        .select("payment_qr_codes, allow_personal_qrcode")
        .eq("user_id", session.user.id)
        .single();

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "获取教练信息失败: " + error.message,
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<GetPaymentQrCodesResponseDto>>({
        success: true,
        message: "获取成功",
        data: {
            qrCodes: (coach.payment_qr_codes as QrCodeItem[]) || [],
            allowPersonalQrcode: coach.allow_personal_qrcode ?? true,
        },
    });
}

// 更新教练的收款码
export async function POST(req: Request) {
    const session = await getServerSession();

    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    // 获取当前用户对应的教练信息
    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id, allow_personal_qrcode")
        .eq("user_id", session.user.id)
        .single();

    if (coachError || !coach) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "获取教练信息失败",
            data: null,
        }, { status: 500 });
    }

    // 检查是否允许使用个人二维码
    if (!coach.allow_personal_qrcode) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "管理员已禁止您使用个人收款码，如有疑问请联系管理员",
            data: null,
        }, { status: 403 });
    }

    const { qrCodes } = await req.json() as UpdatePaymentQrCodesDto;

    // 验证收款码数量（最多2个）
    if (!Array.isArray(qrCodes) || qrCodes.length > 2) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "收款码数量不能超过2个",
            data: null,
        }, { status: 400 });
    }

    // 验证收款码格式
    for (const qr of qrCodes) {
        if (!qr.type || !["wechat", "alipay"].includes(qr.type)) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "收款码类型必须是 wechat 或 alipay",
                data: null,
            }, { status: 400 });
        }
        if (!qr.url) {
            return NextResponse.json<ApiData<null>>({
                success: false,
                message: "收款码图片URL不能为空",
                data: null,
            }, { status: 400 });
        }
    }

    // 更新收款码
    const { data, error } = await supabase
        .from("coaches")
        .update({
            payment_qr_codes: qrCodes,
            updated_at: new Date().toISOString(),
        })
        .eq("id", coach.id)
        .select("payment_qr_codes")
        .single();

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "更新失败: " + error.message,
            data: null,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<UpdatePaymentQrCodesResponseDto>>({
        success: true,
        message: "收款码更新成功",
        data: {
            qrCodes: (data.payment_qr_codes as QrCodeItem[]) || [],
        },
    });
}
