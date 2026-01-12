import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { GetCoachDto, GetCoachResponseDto, QrCodeItem } from "./entity";
import { ApiData } from "@/types/api";
import { CoachesRow } from "@/types";

// 获取全局默认支付模式
async function getDefaultPaymentMode(): Promise<
    "qrcode" | "alipay_api" | "both"
> {
    const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "payment_mode")
        .single();

    return data?.value?.default_mode || "qrcode";
}

export async function POST(req: Request) {
    const {
        id,
        userId,
        needQrCode = false,
        needPaymentInfo = false,
    } = await req.json() as GetCoachDto;

    let coach: CoachesRow | null = null;

    if (id) {
        const { data: coachData, error } = await supabase
            .from("coaches")
            .select("*")
            .eq("id", id)
            .single();

        if (error) {
            return NextResponse.json({
                success: false,
                message: error.message,
            });
        }

        if (!coachData) {
            return NextResponse.json({
                success: false,
                message: "未找到指定的教练",
            });
        }

        coach = coachData;
    }

    if (userId) {
        const { data: coachData, error } = await supabase
            .from("coaches")
            .select("*")
            .eq("user_id", userId)
            .single();

        if (error) {
            return NextResponse.json({
                success: false,
                message: error.message,
            });
        }

        if (!coachData) {
            return NextResponse.json({
                success: false,
                message: "未找到指定的教练",
            });
        }

        coach = coachData;
    }

    // 构建响应数据
    const responseData: GetCoachResponseDto = {
        coach: coach,
    };

    // 如果需要支付信息
    if (needPaymentInfo && coach) {
        const defaultMode = await getDefaultPaymentMode();

        // 确定生效的支付模式
        const effectivePaymentMode = coach.payment_mode || (
            coach.allow_personal_qrcode ? 'qrcode' : defaultMode
        );

        // 获取收款码列表
        const qrCodes: QrCodeItem[] = coach.payment_qr_codes || [];

        responseData.paymentInfo = {
            effectivePaymentMode,
            allowPersonalQrcode: coach.allow_personal_qrcode ?? true,
            qrCodes,
        };
    }

    // 如果不需要二维码信息，清除敏感字段
    if (!needQrCode && !needPaymentInfo && coach) {
        // 清除旧字段（兼容）和新字段
        (coach as any).payment_qr_code = undefined;
        (coach as any).payment_qr_codes = undefined;
    }

    return NextResponse.json<ApiData<GetCoachResponseDto>>({
        success: true,
        message: "获取教练信息成功",
        data: responseData,
    });
}
